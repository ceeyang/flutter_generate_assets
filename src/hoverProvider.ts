import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const ASSET_LINE_RE = /static const String \w+ = '([^']+)';/;

export class AssetHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const line = document.lineAt(position).text;
    const match = ASSET_LINE_RE.exec(line);
    if (!match) return undefined;

    const assetPath = match[1];
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return undefined;

    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.baseUri = vscode.Uri.file(workspaceRoot + '/');

    const previewEnabled = vscode.workspace
      .getConfiguration('flutterGenerateAssets')
      .get<boolean>('hoverPreviewEnabled', false);

    const ext = path.extname(assetPath).toLowerCase();
    if (previewEnabled && IMAGE_EXTENSIONS.has(ext)) {
      const absPath = path.join(workspaceRoot, assetPath);
      if (fs.existsSync(absPath)) {
        markdown.appendMarkdown(`![preview](${assetPath})\n\n`);
      }
    }

    markdown.appendMarkdown(`\`${assetPath}\``);
    return new vscode.Hover(markdown);
  }
}
