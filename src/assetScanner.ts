import * as fs from 'fs';
import * as path from 'path';

const RESOLUTION_DIR_RE = /^\d+(?:\.\d+)?x$/;

export function scanAssets(workspaceRoot: string, assetPaths: string[]): string[] {
  const results: string[] = [];
  for (const assetPath of assetPaths) {
    const trimmed = assetPath.replace(/\/$/, '');
    const absPath = path.join(workspaceRoot, trimmed);
    if (!fs.existsSync(absPath)) continue;
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      collectFiles(absPath, workspaceRoot, results);
    } else {
      results.push(trimmed.replace(/\\/g, '/'));
    }
  }
  return results.sort();
}

function collectFiles(dir: string, workspaceRoot: string, results: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true }) as fs.Dirent[];
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (RESOLUTION_DIR_RE.test(entry.name)) continue;
      collectFiles(fullPath, workspaceRoot, results);
    } else if (entry.isFile()) {
      const rel = path.relative(workspaceRoot, fullPath).replace(/\\/g, '/');
      results.push(rel);
    }
  }
}
