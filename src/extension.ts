import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { readPubspec, PubspecConfig } from './pubspecReader';
import { scanAssets } from './assetScanner';
import { generateDartCode } from './codeGenerator';
import { setupFileWatcher } from './fileWatcher';
import { AssetHoverProvider } from './hoverProvider';

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let isGenerating = false;
let watcherDisposable: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Flutter Generate Assets');
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'flutter-generate-assets.generate';
  setStatusIdle();
  statusBarItem.show();

  const generateCommand = vscode.commands.registerCommand(
    'flutter-generate-assets.generate',
    () => runGenerate()
  );

  const toggleWatchCommand = vscode.commands.registerCommand(
    'flutter-generate-assets.toggleWatch',
    () => toggleWatch()
  );

  const toggleHoverPreviewCommand = vscode.commands.registerCommand(
    'flutter-generate-assets.toggleHoverPreview',
    () => toggleHoverPreview()
  );

  const hoverProvider = new AssetHoverProvider();
  const hoverDisposable = vscode.languages.registerHoverProvider(
    { language: 'dart' },
    hoverProvider
  );

  watcherDisposable = setupFileWatcher(() => runGenerate());

  context.subscriptions.push(
    statusBarItem,
    outputChannel,
    generateCommand,
    toggleWatchCommand,
    toggleHoverPreviewCommand,
    hoverDisposable,
  );

}

async function toggleWatch(): Promise<void> {
  const config = vscode.workspace.getConfiguration('flutterGenerateAssets');
  const current = config.get<boolean>('watchEnabled', false);
  const next = !current;
  await config.update('watchEnabled', next, vscode.ConfigurationTarget.Workspace);

  // Restart watcher based on new state
  if (watcherDisposable) {
    watcherDisposable.dispose();
    watcherDisposable = undefined;
  }
  if (next) {
    watcherDisposable = setupFileWatcher(() => runGenerate());
  }

  vscode.window.showInformationMessage(
    next ? 'Flutter Generate Assets: Watch enabled' : 'Flutter Generate Assets: Watch disabled'
  );
}

async function toggleHoverPreview(): Promise<void> {
  const config = vscode.workspace.getConfiguration('flutterGenerateAssets');
  const current = config.get<boolean>('hoverPreviewEnabled', false);
  const next = !current;
  await config.update('hoverPreviewEnabled', next, vscode.ConfigurationTarget.Workspace);

  vscode.window.showInformationMessage(
    next ? 'Flutter Generate Assets: Hover preview enabled' : 'Flutter Generate Assets: Hover preview disabled'
  );
}

export async function runGenerate(): Promise<void> {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = undefined; }
  if (isGenerating) return;
  isGenerating = true;
  try {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      statusBarItem.text = '$(warning) Assets';
      statusBarItem.tooltip = 'No workspace folder open';
      return;
    }

    let config: PubspecConfig;
    try {
      config = readPubspec(workspaceRoot);
    } catch (err) {
      statusBarItem.text = '$(warning) Assets';
      statusBarItem.tooltip = 'Could not read pubspec.yaml';
      outputChannel.appendLine(`[flutter-generate-assets] Error reading pubspec.yaml: ${err instanceof Error ? err.stack : String(err)}`);
      return;
    }

    statusBarItem.text = '$(sync~spin) Generating...';
    statusBarItem.tooltip = undefined;
    // Yield to let VSCode repaint the status bar before synchronous work begins
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    try {
      const assets = scanAssets(workspaceRoot, config.assetPaths);
      const code = generateDartCode(config.className, assets);

      const outputPath = path.join(workspaceRoot, config.output);
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputPath, code, 'utf-8');

      outputChannel.appendLine(
        `[flutter-generate-assets] Generated ${config.output} (${assets.length} assets)`
      );
      statusBarItem.text = '$(check) Assets';
      statusBarItem.tooltip = `Generated ${config.output}`;
      idleTimer = setTimeout(setStatusIdle, 2000);
    } catch (err) {
      statusBarItem.text = '$(warning) Assets';
      statusBarItem.tooltip = `Generation failed: ${err}`;
      outputChannel.appendLine(`[flutter-generate-assets] Error: ${err instanceof Error ? err.stack : String(err)}`);
    }
  } finally {
    isGenerating = false;
  }
}

function setStatusIdle(): void {
  statusBarItem.text = '$(sync) Assets';
  statusBarItem.tooltip = 'Click to regenerate Flutter assets';
}

export function deactivate(): void {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = undefined; }
  if (watcherDisposable) { watcherDisposable.dispose(); watcherDisposable = undefined; }
}
