# flutter_generate_assets — VSCode Extension Design

**Date:** 2026-04-08

## Overview

A VSCode extension that scans Flutter project assets declared in `pubspec.yaml` and automatically generates a Dart constants file. Supports manual trigger, file watching, and hover image previews.

---

## Project Structure

```
flutter_generate_assets/
├── src/
│   ├── extension.ts          # Entry: register commands, status bar, assemble modules
│   ├── pubspecReader.ts      # Parse pubspec.yaml for config and asset declarations
│   ├── assetScanner.ts       # Scan declared asset paths for actual files
│   ├── codeGenerator.ts      # Generate Dart code string from asset list
│   ├── fileWatcher.ts        # Watch assets directories + pubspec.yaml for changes
│   └── hoverProvider.ts      # Image hover preview in the generated file
├── package.json              # Extension manifest
└── tsconfig.json
```

---

## Configuration

Users configure the extension inside `pubspec.yaml` under `flutter.generate_assets`:

```yaml
flutter:
  generate_assets:
    output: generated/assets.dart   # default
    class_name: Assets               # default
  assets:
    - assets/images/
    - assets/icons/
```

The extension reads `flutter.generate_assets` for output path and class name, and `flutter.assets` for which directories to scan.

VSCode setting to disable file watching:
```json
"flutterGenerateAssets.watchEnabled": true
```

---

## Asset Scanning

- Read paths declared under `flutter.assets`
- Skip files inside resolution subdirectories: `1.5x/`, `2x/`, `3x/`, etc. (Flutter resolves these automatically)
- Only files at the root of each declared directory (and subdirectories that are not resolution variants) are included

---

## Variable Naming Rules (camelCase with path)

Naming derives from the full file path with these steps:
1. Strip the leading `assets/` prefix
2. Strip the file extension
3. Split all path segments and filename on `/`, `_`, `-`
4. Join: first word all lowercase, each subsequent word capitalized
5. If result starts with a digit, prefix with `a`

**Examples:**
```
assets/images/my_icon.png          → imagesMyIcon
assets/icons/arrow-left.svg        → iconsArrowLeft
assets/images/buttons/play.png     → imagesButtonsPlay
assets/images/bg_home.jpg          → imagesBgHome
assets/fonts/2x_bold.ttf           → fonts2XBold
assets/2icons/logo.png             → a2iconsLogo   (digit prefix guard: result started with '2')
```

---

## Generated File Format

```dart
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: lines_longer_than_80_chars, constant_identifier_names
// dart format off
class Assets {
static const String imagesMyIcon = 'assets/images/my_icon.png';
static const String iconsArrowLeft = 'assets/icons/arrow-left.svg';
static const String imagesBgHome = 'assets/images/bg_home.jpg';
}
```

Key decisions:
- `// dart format off` at the top prevents `dart format` and VSCode save-format from modifying the file
- No indentation inside the class body to further resist formatter changes
- `ignore_for_file` suppresses common Dart linter warnings for generated files

---

## Commands & Status Bar

**Command:** `flutter-generate-assets.generate`
- Accessible via Command Palette (`Cmd+Shift+P`) as "Flutter: Generate Assets"

**Status Bar (bottom-right):**
- Idle: `$(sync) Assets`
- Generating: `$(sync~spin) Generating...`
- Success: `$(check) Assets` (reverts to idle after 2s)
- Error/no pubspec: `$(warning) Assets` with tooltip message

---

## File Watching

Two global `FileSystemWatcher` instances (not per-directory):
- `**/pubspec.yaml` — re-reads config and regenerates on change
- `**/assets/**/*` — regenerates on any file add/delete/rename under assets

Both watchers use **500ms debounce** to avoid multiple triggers during bulk file operations.

Watching can be disabled via `flutterGenerateAssets.watchEnabled: false` setting. When disabled, only manual trigger works.

**Activation:** Extension activates only when `pubspec.yaml` exists in the workspace root (`activationEvents: workspaceContains:pubspec.yaml`). Zero overhead in non-Flutter projects.

---

## Hover Image Preview

A `HoverProvider` registered only for the generated `assets.dart` file (matched by configured output path).

**Behavior:**
- On hover over any `static const String` line, extract the asset path from the string literal
- Supported formats for preview: PNG, JPG, JPEG, GIF, WebP, SVG
- Unsupported formats (fonts, JSON, etc.): show path only, no error

**Hover content:**
```markdown
![preview](vscode-resource:/absolute/path/to/asset)

`assets/images/my_icon.png`
```

Uses `vscode-resource:` URI scheme to serve local workspace files into the Markdown renderer. Only works for files inside the workspace (matches our use case).

---

## Error Handling

| Scenario | Behavior |
|---|---|
| No `pubspec.yaml` found | Status bar warning, no crash |
| `flutter.assets` not declared | Empty generated file with header comment |
| Asset file listed but missing on disk | Skip silently, log to Output channel |
| Output directory doesn't exist | Create it automatically |
| Duplicate variable names (name collision) | Append numeric suffix: `imagesIcon`, `imagesIcon2` |

---

## Out of Scope

- Support for remote/network assets
- Generating `AssetImage` or `Image.asset` wrappers (plain strings only)
- Multi-root workspace support (single Flutter project per workspace)
