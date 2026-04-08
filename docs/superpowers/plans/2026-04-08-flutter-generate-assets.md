# Flutter Generate Assets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VSCode extension that auto-generates a Dart asset constants file by scanning Flutter project assets declared in `pubspec.yaml`.

**Architecture:** Six focused modules (pubspecReader, assetScanner, codeGenerator, fileWatcher, hoverProvider) assembled by `extension.ts`. Pure logic modules are unit-tested with Jest; VSCode-API modules are wired in `extension.ts` and manually verified via F5.

**Tech Stack:** TypeScript, VSCode Extension API, js-yaml, Jest + ts-jest, esbuild (bundler)

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Extension manifest: commands, settings, activation events |
| `tsconfig.json` | TypeScript compiler config |
| `esbuild.js` | Bundle script |
| `jest.config.js` | Jest config mapping `vscode` to mock |
| `__mocks__/vscode.ts` | Jest mock for the `vscode` module |
| `src/extension.ts` | Activate: register command, status bar, hover provider, file watcher |
| `src/pubspecReader.ts` | Parse `pubspec.yaml` → output path, class name, asset paths |
| `src/assetScanner.ts` | Expand declared asset paths → list of actual file paths |
| `src/codeGenerator.ts` | Convert file paths → Dart constants file string |
| `src/fileWatcher.ts` | Two debounced FSWatcher instances, respects `watchEnabled` setting |
| `src/hoverProvider.ts` | Show image thumbnail on hover in any Dart file |
| `src/__tests__/pubspecReader.test.ts` | Unit tests for pubspecReader |
| `src/__tests__/assetScanner.test.ts` | Unit tests for assetScanner |
| `src/__tests__/codeGenerator.test.ts` | Unit tests for codeGenerator |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.js`
- Create: `jest.config.js`
- Create: `__mocks__/vscode.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "flutter-generate-assets",
  "displayName": "Flutter Generate Assets",
  "description": "Auto-generate Dart asset constants from Flutter project assets",
  "version": "0.0.1",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["workspaceContains:pubspec.yaml"],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "flutter-generate-assets.generate",
        "title": "Flutter: Generate Assets"
      }
    ],
    "configuration": {
      "title": "Flutter Generate Assets",
      "properties": {
        "flutterGenerateAssets.watchEnabled": {
          "type": "boolean",
          "default": true,
          "description": "Automatically regenerate assets file when files change"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "node esbuild.js",
    "build": "node esbuild.js",
    "watch": "node esbuild.js --watch",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "esbuild": "^0.20.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020"],
    "outDir": "./out",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", ".vscode-test", "**/__tests__/**"]
}
```

- [ ] **Step 3: Create `esbuild.js`**

```js
const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

const ctx = esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
});

ctx.then(async (c) => {
  if (isWatch) {
    await c.watch();
    console.log('watching...');
  } else {
    await c.rebuild();
    await c.dispose();
  }
}).catch(() => process.exit(1));
```

- [ ] **Step 4: Create `jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/__mocks__/vscode.ts',
  },
};
```

- [ ] **Step 5: Create `__mocks__/vscode.ts`**

```typescript
const vscode = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  window: {
    createStatusBarItem: jest.fn(() => ({
      text: '',
      tooltip: '',
      command: '',
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    })),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn(),
    })),
  },
  commands: {
    registerCommand: jest.fn(),
  },
  workspace: {
    workspaceFolders: undefined as any,
    createFileSystemWatcher: jest.fn(() => ({
      onDidCreate: jest.fn(() => ({ dispose: jest.fn() })),
      onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
      onDidDelete: jest.fn(() => ({ dispose: jest.fn() })),
      dispose: jest.fn(),
    })),
    getConfiguration: jest.fn(() => ({
      get: jest.fn((_key: string, def: unknown) => def),
    })),
  },
  languages: {
    registerHoverProvider: jest.fn(() => ({ dispose: jest.fn() })),
  },
  Hover: class {
    constructor(public contents: unknown) {}
  },
  MarkdownString: class {
    value = '';
    isTrusted = false;
    appendMarkdown(s: string) { this.value += s; return this; }
  },
  Uri: {
    file: jest.fn((p: string) => ({
      fsPath: p,
      toString: () => `file://${p}`,
    })),
  },
  Disposable: {
    from: jest.fn((...items: { dispose(): unknown }[]) => ({
      dispose: () => items.forEach(i => i.dispose()),
    })),
  },
};

module.exports = vscode;
```

- [ ] **Step 6: Install dependencies**

```bash
cd /Users/cee/Documents/github/flutter_generate_assets
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Verify TypeScript compiles**

Create a minimal `src/extension.ts` placeholder so the build does not fail:

```typescript
import * as vscode from 'vscode';
export function activate(_context: vscode.ExtensionContext) {}
export function deactivate() {}
```

Then run:

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold VSCode extension project"
```

---

## Task 2: pubspecReader Module

**Files:**
- Create: `src/pubspecReader.ts`
- Create: `src/__tests__/pubspecReader.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/pubspecReader.test.ts`:

```typescript
import { readPubspec } from '../pubspecReader';
import * as fs from 'fs';

jest.mock('fs');

const mockReadFileSync = fs.readFileSync as jest.Mock;

describe('readPubspec', () => {
  it('returns defaults when generate_assets is not configured', () => {
    mockReadFileSync.mockReturnValue(`
name: my_app
flutter:
  assets:
    - assets/images/
`);
    const config = readPubspec('/workspace');
    expect(config.output).toBe('generated/assets.dart');
    expect(config.className).toBe('Assets');
    expect(config.assetPaths).toEqual(['assets/images/']);
  });

  it('reads custom output and class_name from generate_assets', () => {
    mockReadFileSync.mockReturnValue(`
flutter:
  generate_assets:
    output: lib/gen/assets.dart
    class_name: R
  assets:
    - assets/images/
    - assets/icons/
`);
    const config = readPubspec('/workspace');
    expect(config.output).toBe('lib/gen/assets.dart');
    expect(config.className).toBe('R');
    expect(config.assetPaths).toEqual(['assets/images/', 'assets/icons/']);
  });

  it('returns empty assetPaths when flutter.assets is not declared', () => {
    mockReadFileSync.mockReturnValue(`
name: my_app
flutter:
  generate_assets:
    output: lib/assets.dart
`);
    const config = readPubspec('/workspace');
    expect(config.assetPaths).toEqual([]);
  });

  it('reads pubspec from the correct path', () => {
    mockReadFileSync.mockReturnValue('flutter:\n');
    readPubspec('/my/project');
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining('pubspec.yaml'),
      'utf-8'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=pubspecReader
```

Expected: FAIL — `Cannot find module '../pubspecReader'`

- [ ] **Step 3: Implement `src/pubspecReader.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface PubspecConfig {
  output: string;
  className: string;
  assetPaths: string[];
}

export function readPubspec(workspaceRoot: string): PubspecConfig {
  const pubspecPath = path.join(workspaceRoot, 'pubspec.yaml');
  const content = fs.readFileSync(pubspecPath, 'utf-8');
  const doc = yaml.load(content) as Record<string, unknown>;

  const flutter = (doc?.flutter as Record<string, unknown>) ?? {};
  const generateAssets = (flutter?.generate_assets as Record<string, unknown>) ?? {};

  return {
    output: (generateAssets.output as string) ?? 'generated/assets.dart',
    className: (generateAssets.class_name as string) ?? 'Assets',
    assetPaths: ((flutter?.assets as string[]) ?? []),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=pubspecReader
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/pubspecReader.ts src/__tests__/pubspecReader.test.ts
git commit -m "feat: add pubspecReader module with tests"
```

---

## Task 3: assetScanner Module

**Files:**
- Create: `src/assetScanner.ts`
- Create: `src/__tests__/assetScanner.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/assetScanner.test.ts`:

```typescript
import { scanAssets } from '../assetScanner';
import * as fs from 'fs';

jest.mock('fs');

const mockExistsSync = fs.existsSync as jest.Mock;
const mockStatSync = fs.statSync as jest.Mock;
const mockReaddirSync = fs.readdirSync as jest.Mock;

function dir(name: string): fs.Dirent {
  return { name, isDirectory: () => true, isFile: () => false } as fs.Dirent;
}
function file(name: string): fs.Dirent {
  return { name, isDirectory: () => false, isFile: () => true } as fs.Dirent;
}

describe('scanAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true });
  });

  it('collects files from a declared directory', () => {
    mockReaddirSync.mockReturnValue([file('logo.png'), file('bg.jpg')]);
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result).toContain('assets/images/logo.png');
    expect(result).toContain('assets/images/bg.jpg');
  });

  it('skips 2x resolution subdirectory', () => {
    mockReaddirSync.mockImplementation((d: string) => {
      if (d.endsWith('images')) return [file('logo.png'), dir('2x')];
      return [];
    });
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result).toContain('assets/images/logo.png');
    expect(result.some(r => r.includes('/2x/'))).toBe(false);
  });

  it('skips 3x resolution subdirectory', () => {
    mockReaddirSync.mockImplementation((d: string) => {
      if (d.endsWith('images')) return [file('icon.png'), dir('3x')];
      return [];
    });
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result.some(r => r.includes('/3x/'))).toBe(false);
  });

  it('skips 1.5x resolution subdirectory', () => {
    mockReaddirSync.mockImplementation((d: string) => {
      if (d.endsWith('images')) return [file('icon.png'), dir('1.5x')];
      return [];
    });
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result.some(r => r.includes('/1.5x/'))).toBe(false);
  });

  it('recurses into non-resolution subdirectories', () => {
    mockReaddirSync.mockImplementation((d: string) => {
      if (d.endsWith('images')) return [dir('buttons')];
      if (d.endsWith('buttons')) return [file('play.png')];
      return [];
    });
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result).toContain('assets/images/buttons/play.png');
  });

  it('skips paths that do not exist on disk', () => {
    mockExistsSync.mockReturnValue(false);
    const result = scanAssets('/workspace', ['assets/missing/']);
    expect(result).toEqual([]);
  });

  it('handles multiple declared asset paths', () => {
    mockReaddirSync.mockImplementation((d: string) => {
      if (d.endsWith('images')) return [file('logo.png')];
      if (d.endsWith('icons')) return [file('arrow.svg')];
      return [];
    });
    const result = scanAssets('/workspace', ['assets/images/', 'assets/icons/']);
    expect(result).toContain('assets/images/logo.png');
    expect(result).toContain('assets/icons/arrow.svg');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=assetScanner
```

Expected: FAIL — `Cannot find module '../assetScanner'`

- [ ] **Step 3: Implement `src/assetScanner.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';

const RESOLUTION_DIR_RE = /^[\d.]+x$/;

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
    } else {
      const rel = path.relative(workspaceRoot, fullPath).replace(/\\/g, '/');
      results.push(rel);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=assetScanner
```

Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/assetScanner.ts src/__tests__/assetScanner.test.ts
git commit -m "feat: add assetScanner module with tests"
```

---

## Task 4: codeGenerator Module

**Files:**
- Create: `src/codeGenerator.ts`
- Create: `src/__tests__/codeGenerator.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/codeGenerator.test.ts`:

```typescript
import { toVariableName, generateDartCode } from '../codeGenerator';

describe('toVariableName', () => {
  it('converts simple underscore path to camelCase', () => {
    expect(toVariableName('assets/images/my_icon.png')).toBe('imagesMyIcon');
  });

  it('converts hyphenated filename to camelCase', () => {
    expect(toVariableName('assets/icons/arrow-left.svg')).toBe('iconsArrowLeft');
  });

  it('includes nested subdirectory segments', () => {
    expect(toVariableName('assets/images/buttons/play.png')).toBe('imagesButtonsPlay');
  });

  it('lowercases all of first word', () => {
    expect(toVariableName('assets/images/bg_home.jpg')).toBe('imagesBgHome');
  });

  it('prefixes with a when result starts with a digit', () => {
    expect(toVariableName('assets/2icons/logo.png')).toBe('a2iconsLogo');
  });

  it('handles digit within a non-first segment', () => {
    expect(toVariableName('assets/fonts/2x_bold.ttf')).toBe('fonts2xBold');
  });

  it('handles single-level path', () => {
    expect(toVariableName('assets/images/logo.png')).toBe('imagesLogo');
  });
});

describe('generateDartCode', () => {
  it('includes the generated file header', () => {
    const code = generateDartCode('Assets', ['assets/images/logo.png']);
    expect(code).toContain('// GENERATED CODE - DO NOT MODIFY BY HAND');
    expect(code).toContain('// ignore_for_file: lines_longer_than_80_chars, constant_identifier_names');
    expect(code).toContain('// dart format off');
  });

  it('generates a class with the given name', () => {
    const code = generateDartCode('R', ['assets/images/logo.png']);
    expect(code).toContain('class R {');
  });

  it('generates static const String entries', () => {
    const code = generateDartCode('Assets', ['assets/images/logo.png']);
    expect(code).toContain("static const String imagesLogo = 'assets/images/logo.png';");
  });

  it('generates an empty class when asset list is empty', () => {
    const code = generateDartCode('Assets', []);
    expect(code).toContain('class Assets {');
    expect(code).toContain('}');
    expect(code).not.toContain('static const');
  });

  it('appends numeric suffix for duplicate variable names', () => {
    // 'assets/my-icon/logo.png' and 'assets/my_icon/logo.png' both → myIconLogo
    const code = generateDartCode('Assets', [
      'assets/my-icon/logo.png',
      'assets/my_icon/logo.png',
    ]);
    expect(code).toContain('static const String myIconLogo =');
    expect(code).toContain('static const String myIconLogo2 =');
  });

  it('uses Assets as default class name', () => {
    const code = generateDartCode('Assets', ['assets/images/logo.png']);
    expect(code).toContain('class Assets {');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=codeGenerator
```

Expected: FAIL — `Cannot find module '../codeGenerator'`

- [ ] **Step 3: Implement `src/codeGenerator.ts`**

```typescript
export function toVariableName(filePath: string): string {
  // Strip leading 'assets/' prefix
  const withoutPrefix = filePath.startsWith('assets/')
    ? filePath.slice('assets/'.length)
    : filePath;
  // Strip file extension
  const withoutExt = withoutPrefix.replace(/\.[^/.]+$/, '');
  // Split on path separators and word separators
  const words = withoutExt.split(/[/\-_]+/).filter(Boolean);
  // camelCase: first word all lowercase, subsequent words capitalize first char
  const camel = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
  // Prefix 'a' if result starts with a digit
  return /^\d/.test(camel) ? 'a' + camel : camel;
}

export function generateDartCode(className: string, assets: string[]): string {
  const seen = new Map<string, number>();
  const lines: string[] = [
    '// GENERATED CODE - DO NOT MODIFY BY HAND',
    '// ignore_for_file: lines_longer_than_80_chars, constant_identifier_names',
    '// dart format off',
    `class ${className} {`,
  ];

  for (const assetPath of assets) {
    let varName = toVariableName(assetPath);
    if (seen.has(varName)) {
      const count = seen.get(varName)! + 1;
      seen.set(varName, count);
      varName = varName + count;
    } else {
      seen.set(varName, 1);
    }
    lines.push(`static const String ${varName} = '${assetPath}';`);
  }

  lines.push('}');
  return lines.join('\n');
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: PASS — all tests across all three test files passing.

- [ ] **Step 5: Commit**

```bash
git add src/codeGenerator.ts src/__tests__/codeGenerator.test.ts
git commit -m "feat: add codeGenerator module with naming and Dart code generation"
```

---

## Task 5: extension.ts — Command, Status Bar, Generate Flow

**Files:**
- Modify: `src/extension.ts` (replace placeholder)

- [ ] **Step 1: Replace `src/extension.ts` with full implementation**

```typescript
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
    outputChannel.appendLine(`[flutter-generate-assets] Error reading pubspec.yaml: ${err}`);
    return;
  }

  statusBarItem.text = '$(sync~spin) Generating...';
  statusBarItem.tooltip = undefined;

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
    setTimeout(setStatusIdle, 2000);
  } catch (err) {
    statusBarItem.text = '$(warning) Assets';
    statusBarItem.tooltip = `Generation failed: ${err}`;
    outputChannel.appendLine(`[flutter-generate-assets] Error: ${err}`);
  }
}

function setStatusIdle(): void {
  statusBarItem.text = '$(sync) Assets';
  statusBarItem.tooltip = 'Click to regenerate Flutter assets';
}

export function deactivate(): void {}
```

- [ ] **Step 2: Create placeholder stubs for not-yet-implemented modules**

Create `src/fileWatcher.ts`:

```typescript
import * as vscode from 'vscode';
export function setupFileWatcher(_onChanged: () => void): vscode.Disposable | undefined {
  return undefined;
}
```

Create `src/hoverProvider.ts`:

```typescript
import * as vscode from 'vscode';
export class AssetHoverProvider implements vscode.HoverProvider {
  provideHover(): vscode.Hover | undefined {
    return undefined;
  }
}
```

- [ ] **Step 3: Build and verify no TypeScript errors**

```bash
npm run typecheck && npm run build
```

Expected: `dist/extension.js` created, no type errors.

- [ ] **Step 4: Manual smoke test**

Open a Flutter project folder in VSCode. Press `F5` to launch the Extension Development Host.

Verify:
- Status bar shows `$(sync) Assets` in bottom-right
- `Cmd+Shift+P` → "Flutter: Generate Assets" appears
- Running the command creates `generated/assets.dart` in the Flutter project
- Status bar briefly shows `$(check) Assets` then returns to idle

- [ ] **Step 5: Commit**

```bash
git add src/extension.ts src/fileWatcher.ts src/hoverProvider.ts
git commit -m "feat: implement extension entry point, command, and status bar"
```

---

## Task 6: fileWatcher Module

**Files:**
- Modify: `src/fileWatcher.ts` (replace stub)

- [ ] **Step 1: Replace `src/fileWatcher.ts` with full implementation**

```typescript
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
  const assetsWatcher = vscode.workspace.createFileSystemWatcher('**/assets/**/*');

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
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

With the Extension Development Host running (F5):
1. Add a new image file to `assets/images/` in the Flutter project
2. Wait ~500ms
3. Verify `generated/assets.dart` is updated with the new asset

- [ ] **Step 4: Verify `watchEnabled: false` disables watchers**

In the Flutter project's `.vscode/settings.json`, add:
```json
{ "flutterGenerateAssets.watchEnabled": false }
```
Reload the Extension Development Host. Add a file — verify the file is **not** auto-regenerated. Remove the setting when done.

- [ ] **Step 5: Commit**

```bash
git add src/fileWatcher.ts
git commit -m "feat: implement debounced file watcher for assets and pubspec"
```

---

## Task 7: hoverProvider Module

**Files:**
- Modify: `src/hoverProvider.ts` (replace stub)

- [ ] **Step 1: Replace `src/hoverProvider.ts` with full implementation**

```typescript
import * as vscode from 'vscode';
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
    markdown.supportHtml = true;

    const ext = path.extname(assetPath).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      const absPath = path.join(workspaceRoot, assetPath);
      const uri = vscode.Uri.file(absPath);
      markdown.appendMarkdown(`![preview](${uri.toString()})\n\n`);
    }

    markdown.appendMarkdown(`\`${assetPath}\``);
    return new vscode.Hover(markdown);
  }
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

With the Extension Development Host running (F5) and `generated/assets.dart` open:
1. Hover over a line like `static const String imagesLogo = 'assets/images/logo.png';`
2. Verify a popup appears showing the image thumbnail and the asset path
3. Hover over a `.ttf` font line — verify only the path is shown, no image error

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Final commit**

```bash
git add src/hoverProvider.ts
git commit -m "feat: implement image hover preview for generated assets file"
```

---

## Self-Review Checklist

- [x] **pubspecReader** — reads `output`, `class_name`, `assetPaths`; defaults covered; tests present
- [x] **assetScanner** — resolution dirs filtered (`2x`, `3x`, `1.5x`); recursion into subdirs; missing paths skipped; tests present
- [x] **codeGenerator** — camelCase naming with path segments; digit prefix guard; duplicate suffix; header with `dart format off`; tests present
- [x] **Status bar** — idle / spinning / check / warning states; 2s reset
- [x] **Command** — `flutter-generate-assets.generate` registered; Command Palette visible
- [x] **File watcher** — 2 global glob watchers; 500ms debounce; `watchEnabled` setting respected
- [x] **Hover provider** — image formats shown; non-image formats path-only; `isTrusted` set
- [x] **Auto-generate on activation** — called in `activate()`
- [x] **Output directory creation** — `mkdirSync({ recursive: true })` before write
- [x] **Error handling** — pubspec missing → status warning; scan/write error → status warning + output channel log
