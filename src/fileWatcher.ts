import * as vscode from 'vscode';

export function setupFileWatcher(onChanged: () => void): vscode.Disposable | undefined {
  const config = vscode.workspace.getConfiguration('flutterGenerateAssets');
  const watchEnabled = config.get<boolean>('watchEnabled', true);
  if (!watchEnabled) return undefined;

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function debounced(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(onChanged, 500);
  }

  const pubspecWatcher = vscode.workspace.createFileSystemWatcher('**/pubspec.yaml');
  const assetsWatcher = vscode.workspace.createFileSystemWatcher('**/assets/**');

  const disposables: vscode.Disposable[] = [
    pubspecWatcher.onDidChange(debounced),
    pubspecWatcher.onDidCreate(debounced),
    assetsWatcher.onDidCreate(debounced),
    assetsWatcher.onDidChange(debounced),
    assetsWatcher.onDidDelete(debounced),
    pubspecWatcher,
    assetsWatcher,
  ];

  return new vscode.Disposable(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    disposables.forEach(d => d.dispose());
  });
}
