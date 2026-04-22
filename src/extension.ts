import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { readPubspec, PubspecConfig } from './pubspecReader';
import { scanAssets } from './assetScanner';
import { generateDartCode } from './codeGenerator';
import { setupFileWatcher } from './fileWatcher';
import { AssetHoverProvider } from './hoverProvider';
import { findUnusedAssets, findResolutionVariants, UnusedAssetEntry } from './unusedScanner';

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let isGenerating = false;
let watcherDisposable: vscode.Disposable | undefined;
let unusedDiagnostics: vscode.DiagnosticCollection;
let lastUnusedAssets: UnusedAssetEntry[] = [];

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Flutter Generate Assets');
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'flutter-generate-assets.generate';
  setStatusIdle();
  statusBarItem.show();

  unusedDiagnostics = vscode.languages.createDiagnosticCollection('flutter-generate-assets-unused');

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

  const findUnusedCommand = vscode.commands.registerCommand(
    'flutter-generate-assets.findUnused',
    () => runFindUnused()
  );

  const deleteUnusedCommand = vscode.commands.registerCommand(
    'flutter-generate-assets.deleteUnused',
    () => runDeleteUnused()
  );

  const buildRunnerCommand = vscode.commands.registerCommand(
    'flutter-generate-assets.buildRunner',
    () => runBuildRunner()
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
    unusedDiagnostics,
    generateCommand,
    toggleWatchCommand,
    toggleHoverPreviewCommand,
    findUnusedCommand,
    deleteUnusedCommand,
    buildRunnerCommand,
    hoverDisposable,
  );
}

async function toggleWatch(): Promise<void> {
  const config = vscode.workspace.getConfiguration('flutterGenerateAssets');
  const next = !config.get<boolean>('watchEnabled', false);
  await config.update('watchEnabled', next, vscode.ConfigurationTarget.Workspace);

  if (watcherDisposable) { watcherDisposable.dispose(); watcherDisposable = undefined; }
  if (next) { watcherDisposable = setupFileWatcher(() => runGenerate()); }

  vscode.window.showInformationMessage(
    next ? 'Flutter Generate Assets: Watch enabled' : 'Flutter Generate Assets: Watch disabled'
  );
}

async function toggleHoverPreview(): Promise<void> {
  const config = vscode.workspace.getConfiguration('flutterGenerateAssets');
  const next = !config.get<boolean>('hoverPreviewEnabled', false);
  await config.update('hoverPreviewEnabled', next, vscode.ConfigurationTarget.Workspace);

  vscode.window.showInformationMessage(
    next ? 'Flutter Generate Assets: Hover preview enabled' : 'Flutter Generate Assets: Hover preview disabled'
  );
}

async function runFindUnused(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return;

  let config: PubspecConfig;
  try {
    config = readPubspec(workspaceRoot);
  } catch {
    vscode.window.showWarningMessage('Flutter Generate Assets: Could not read pubspec.yaml');
    return;
  }

  const generatedFilePath = path.join(workspaceRoot, config.output);
  if (!fs.existsSync(generatedFilePath)) {
    vscode.window.showWarningMessage(
      `Flutter Generate Assets: Generated file not found — run "Flutter: Generate Assets" first`
    );
    return;
  }

  const unused = findUnusedAssets(workspaceRoot, config.className, generatedFilePath);
  lastUnusedAssets = unused;
  unusedDiagnostics.clear();

  if (unused.length === 0) {
    vscode.window.showInformationMessage('Flutter Generate Assets: No unused assets found');
    return;
  }

  // Mark unused constants as warnings in the generated file
  const generatedUri = vscode.Uri.file(generatedFilePath);
  const fileContent = fs.readFileSync(generatedFilePath, 'utf-8');
  const lines = fileContent.split('\n');

  const diagnostics: vscode.Diagnostic[] = unused.map(({ line, assetPath, varName }) => {
    const lineText = lines[line] ?? '';
    const start = lineText.indexOf(varName);
    const range = new vscode.Range(
      line, start >= 0 ? start : 0,
      line, lineText.length
    );
    const diag = new vscode.Diagnostic(
      range,
      `Unused asset: '${assetPath}'`,
      vscode.DiagnosticSeverity.Warning
    );
    diag.source = 'Flutter Generate Assets';
    return diag;
  });

  unusedDiagnostics.set(generatedUri, diagnostics);

  outputChannel.clear();
  outputChannel.appendLine(`[flutter-generate-assets] Found ${unused.length} unused asset(s):`);
  unused.forEach(({ assetPath }) => outputChannel.appendLine(`  - ${assetPath}`));
  outputChannel.show(true);

  vscode.window.showWarningMessage(
    `Flutter Generate Assets: ${unused.length} unused asset(s) found — run "Flutter: Delete Unused Assets" to remove them`
  );
}

async function runDeleteUnused(): Promise<void> {
  if (lastUnusedAssets.length === 0) {
    vscode.window.showInformationMessage(
      'Flutter Generate Assets: Run "Flutter: Find Unused Assets" first'
    );
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return;

  // Collect main files + resolution variants for each unused asset
  const toDelete: string[] = [];
  for (const { assetPath } of lastUnusedAssets) {
    toDelete.push(assetPath);
    const variants = findResolutionVariants(workspaceRoot, assetPath);
    toDelete.push(...variants);
  }

  const confirmed = await vscode.window.showWarningMessage(
    `Delete ${toDelete.length} file(s)? This cannot be undone.`,
    { modal: true, detail: toDelete.join('\n') },
    'Delete'
  );
  if (confirmed !== 'Delete') return;

  let deleted = 0;
  for (const rel of toDelete) {
    try {
      fs.unlinkSync(path.join(workspaceRoot, rel));
      deleted++;
      outputChannel.appendLine(`[flutter-generate-assets] Deleted: ${rel}`);
    } catch (err) {
      outputChannel.appendLine(`[flutter-generate-assets] Failed to delete ${rel}: ${err}`);
    }
  }

  lastUnusedAssets = [];
  unusedDiagnostics.clear();
  outputChannel.show(true);

  vscode.window.showInformationMessage(`Flutter Generate Assets: Deleted ${deleted} file(s)`);

  // Regenerate constants file to reflect deleted assets
  await runGenerate();
}

function runBuildRunner(): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const terminal = vscode.window.createTerminal({ name: 'Flutter Build Runner', cwd: workspaceRoot });
  terminal.show();
  terminal.sendText('flutter pub run build_runner build --delete-conflicting-outputs');
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

      // Clear stale unused diagnostics and results when file is regenerated
      unusedDiagnostics.clear();
      lastUnusedAssets = [];

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
