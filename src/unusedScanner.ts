import * as fs from 'fs';
import * as path from 'path';

const RESOLUTION_DIR_RE = /^\d+(?:\.\d+)?x$/;

export interface UnusedAssetEntry {
  assetPath: string;
  varName: string;
  line: number; // 0-based line index in generated file
}

function collectDartFiles(dir: string, excludePath: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true }) as fs.Dirent[];
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectDartFiles(full, excludePath));
    } else if (entry.isFile() && entry.name.endsWith('.dart') && full !== excludePath) {
      results.push(full);
    }
  }
  return results;
}

export function findUnusedAssets(
  workspaceRoot: string,
  className: string,
  generatedFilePath: string,
): UnusedAssetEntry[] {
  if (!fs.existsSync(generatedFilePath)) return [];

  // Parse generated file to extract varName + assetPath + line number
  const generatedLines = fs.readFileSync(generatedFilePath, 'utf-8').split('\n');
  const lineRe = /^\s*static const String (\w+) = '([^']+)';/;
  const entries: UnusedAssetEntry[] = [];
  generatedLines.forEach((line, i) => {
    const m = lineRe.exec(line);
    if (m) entries.push({ varName: m[1], assetPath: m[2], line: i });
  });

  if (entries.length === 0) return [];

  // Read all dart files under lib/ except the generated file itself
  const libDir = path.join(workspaceRoot, 'lib');
  const dartFiles = collectDartFiles(libDir, generatedFilePath);
  const allContents = dartFiles.map(f => {
    try { return fs.readFileSync(f, 'utf-8'); } catch { return ''; }
  }).join('\n');

  return entries.filter(({ assetPath, varName }) => {
    const literalUsed =
      allContents.includes(`'${assetPath}'`) ||
      allContents.includes(`"${assetPath}"`);
    const constUsed = allContents.includes(`${className}.${varName}`);
    return !literalUsed && !constUsed;
  });
}

/**
 * For a given asset path, find all resolution variant copies (2x, 3x, etc.)
 * that live in sibling subdirectories of the same name.
 * e.g. assets/icons/logo.png → assets/icons/2x/logo.png, assets/icons/3x/logo.png
 */
export function findResolutionVariants(workspaceRoot: string, assetPath: string): string[] {
  const absAsset = path.join(workspaceRoot, assetPath);
  const parentDir = path.dirname(absAsset);
  const filename = path.basename(absAsset);
  const variants: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(parentDir, { withFileTypes: true }) as fs.Dirent[];
  } catch {
    return variants;
  }

  for (const entry of entries) {
    if (entry.isDirectory() && RESOLUTION_DIR_RE.test(entry.name)) {
      const candidate = path.join(parentDir, entry.name, filename);
      if (fs.existsSync(candidate)) {
        variants.push(path.relative(workspaceRoot, candidate).replace(/\\/g, '/'));
      }
    }
  }

  return variants;
}
