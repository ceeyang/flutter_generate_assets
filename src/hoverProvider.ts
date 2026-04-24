import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { readPubspec } from './pubspecReader';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

// Cache: varName → assetPath, keyed by generated file path + mtime
let _constMap: Map<string, string> = new Map();
let _cacheGenPath: string | undefined;
let _cacheMtime: number | undefined;

function getConstMap(genPath: string): Map<string, string> {
  try {
    const mtime = fs.statSync(genPath).mtimeMs;
    if (_cacheGenPath === genPath && _cacheMtime === mtime) {
      return _constMap;
    }
    const lines = fs.readFileSync(genPath, 'utf-8').split('\n');
    const map = new Map<string, string>();
    const re = /static const String (\w+) = '([^']+)';/;
    for (const line of lines) {
      const m = re.exec(line);
      if (m) map.set(m[1], m[2]);
    }
    _constMap = map;
    _cacheGenPath = genPath;
    _cacheMtime = mtime;
    return map;
  } catch {
    return new Map();
  }
}

export class AssetHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return undefined;

    const line = document.lineAt(position).text;
    const col = position.character;

    const assetPath =
      this._resolveConstRef(line, col, workspaceRoot) ??
      this._resolveStringLiteral(line, col) ??
      this._resolveGeneratedLine(line);

    if (!assetPath) return undefined;

    return this._buildHover(assetPath, workspaceRoot);
  }

  /** Resolve Assets.varName → asset path via generated file cache */
  private _resolveConstRef(
    line: string,
    col: number,
    workspaceRoot: string,
  ): string | undefined {
    let config: ReturnType<typeof readPubspec>;
    try { config = readPubspec(workspaceRoot); } catch { return undefined; }

    const genPath = path.join(workspaceRoot, config.output);
    const constMap = getConstMap(genPath);
    if (constMap.size === 0) return undefined;

    const re = new RegExp(`\\b(${config.className})\\.(\\w+)\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (col >= m.index && col < m.index + m[0].length) {
        return constMap.get(m[2]);
      }
    }
    return undefined;
  }

  /** Match cursor inside 'assets/...' or "assets/..." string literal */
  private _resolveStringLiteral(line: string, col: number): string | undefined {
    const re = /'(assets\/[^']+)'|"(assets\/[^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (col >= m.index && col < m.index + m[0].length) {
        return m[1] ?? m[2];
      }
    }
    return undefined;
  }

  /** Match the generated file line pattern directly */
  private _resolveGeneratedLine(line: string): string | undefined {
    const m = /static const String \w+ = '([^']+)';/.exec(line);
    return m?.[1];
  }

  private _buildHover(assetPath: string, workspaceRoot: string): vscode.Hover {
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
