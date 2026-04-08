# Flutter Generate Assets

A VSCode extension that automatically generates Dart asset constants from your Flutter project's `pubspec.yaml`.

## Features

- **Auto-generate** a Dart constants file from all declared Flutter assets
- **File watching** — regenerates automatically when assets are added, removed, or renamed
- **Image hover preview** — hover over any asset constant to see a thumbnail (optional)
- **Smart naming** — converts file paths to camelCase variable names including directory segments
- **Format-safe** — generated file uses `// dart format off` to prevent auto-formatter interference
- **Resolution-aware** — ignores `2x`, `3x`, `1.5x` resolution variant directories automatically

## Generated Output

Given this `pubspec.yaml`:

```yaml
flutter:
  assets:
    - assets/images/
    - assets/icons/
```

The extension generates `lib/generated/assets.dart`:

```dart
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: lines_longer_than_80_chars, constant_identifier_names
// dart format off
class Assets {
  static const String imagesLogo = 'assets/images/logo.png';
  static const String imagesBgHome = 'assets/images/bg_home.jpg';
  static const String iconsArrowLeft = 'assets/icons/arrow-left.svg';
}
```

## Configuration

Add to your `pubspec.yaml` to customize output:

```yaml
flutter:
  generate_assets:
    output: lib/generated/assets.dart   # default
    class_name: Assets                   # default
```

VSCode settings:

| Setting | Default | Description |
|---|---|---|
| `flutterGenerateAssets.watchEnabled` | `true` | Auto-regenerate on file changes |
| `flutterGenerateAssets.hoverPreviewEnabled` | `false` | Show image thumbnails on hover |

## Usage

**Trigger generation:**
- Click the `⟳ Assets` button in the status bar
- Right-click `pubspec.yaml` → **Flutter: Generate Assets**
- Open `pubspec.yaml` and click the `⟳` icon in the editor title bar
- `Cmd+Shift+P` → **Flutter: Generate Assets**

## Requirements

- VSCode 1.85.0 or later
- A Flutter project with `pubspec.yaml` at the workspace root

## License

MIT
