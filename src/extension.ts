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

  const hoverProvider = new AssetHoverProvider();
  const hoverDisposable = vscode.languages.registerHoverProvider(
    { language: 'dart' },
    hoverProvider
  );

  const watcherDisposable = setupFileWatcher(() => runGenerate());

  context.subscriptions.push(
    statusBarItem,
    outputChannel,
    generateCommand,
    hoverDisposable,
    ...(watcherDisposable ? [watcherDisposable] : [])
  );

  // Auto-generate on activation
  runGenerate();
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
}
