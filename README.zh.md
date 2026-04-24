# Flutter Generate Assets

[English](README.md) | [中文](README.zh.md)

一个 VSCode 插件，从 Flutter 项目的 `pubspec.yaml` 中自动生成 Dart 资源常量文件。

> 同时提供 **Dart CLI 工具**：[generate_assets](https://github.com/ceeyang/generate_assets) — 通过 `dart run generate_assets` 提供相同功能，无需 VSCode。

## 功能特性

- **手动触发** — 通过命令面板、状态栏或右键菜单触发生成
- **文件监听** — 可选地在资源变更时自动重新生成（默认关闭）
- **图片悬停预览** — 鼠标悬停在资源常量上时显示缩略图（可选）
- **智能命名** — 将文件路径转换为 camelCase，包含目录层级；当同名文件存在不同格式时，自动在末尾追加扩展名加以区分（例如 `copyToClipboardPng` / `copyToClipboardSvg`）
- **格式安全** — 生成文件顶部添加 `// dart format off`，防止 Dart 格式化工具修改生成内容
- **分辨率感知** — 自动忽略 `2x`、`3x`、`1.5x` 等分辨率变体目录
- **未使用资源检测** — 扫描 `lib/` 下的 Dart 文件，在生成文件中高亮标记未使用的常量
- **批量删除** — 一键删除未使用的资源文件，同时删除所有分辨率变体（2x、3x 等）

## 命令列表

所有命令均可通过 `Cmd+Shift+P`、`pubspec.yaml` 右键菜单或编辑器标题栏访问。

| 命令 | 说明 |
|---|---|
| **Flutter: Generate Assets** | 根据声明的资源生成 Dart 常量文件 |
| **Flutter: Toggle Asset Watch** | 开启/关闭文件变更时自动重新生成 |
| **Flutter: Toggle Asset Hover Preview** | 开启/关闭悬停图片缩略图预览 |
| **Flutter: Find Unused Assets** | 扫描 `lib/` 并对未使用的资源常量添加警告标记 |
| **Flutter: Delete Unused Assets** | 批量删除上次扫描找到的未使用资源（含 `2x`/`3x` 变体） |
| **Flutter: Run Build Runner** | 在终端运行 `flutter pub run build_runner build --delete-conflicting-outputs` |

## 使用方式

### 生成常量文件

- `Cmd+Shift+P` → **Flutter: Generate Assets**
- 在资源管理器中右键点击 `pubspec.yaml` → **Flutter: Generate Assets**
- 打开 `pubspec.yaml`，点击编辑器标题栏中的 `⟳` 图标
- 点击状态栏中的 `⟳ Assets` 按钮

### 查找并删除未使用的资源

1. `Cmd+Shift+P` → **Flutter: Find Unused Assets**
   - 未使用的常量在生成文件中显示黄色警告波浪线
   - Output Channel 中列出所有未使用的资源路径
2. `Cmd+Shift+P` → **Flutter: Delete Unused Assets**
   - 弹出确认对话框，列出所有将被删除的文件（包括 `2x`、`3x` 变体）
   - 删除完成后自动重新生成常量文件

> **注意：** 通过字符串插值引用的资源（如 `'assets/$name.png'`）无法被静态检测，可能会被误报为未使用。

## 配置

在 `pubspec.yaml` **根节点**添加 `flutter_generate_assets` 配置项：

```yaml
flutter_generate_assets:
  output: lib/common/assets.dart   # 默认值：lib/generated/assets.dart
  class_name: Assets               # 默认值：Assets
  strip_prefix: assets/            # 默认值：assets/ — 生成变量名前剥离此前缀

flutter:
  assets:
    - assets/images/
    - assets/icons/
```

### `strip_prefix`

控制生成 camelCase 变量名时剥离的路径前缀。

```yaml
# 单个前缀（字符串）
flutter_generate_assets:
  strip_prefix: assets/

# 多个前缀（列表）— 匹配第一个
flutter_generate_assets:
  strip_prefix:
    - assets/
    - images/
```

示例：配置 `strip_prefix: assets/` 后，路径 `assets/images/logo.png` 生成变量名 `imagesLogo`，而非 `assetsImagesLogo`。

VSCode 设置项：

| 设置项 | 默认值 | 说明 |
|---|---|---|
| `flutterGenerateAssets.watchEnabled` | `false` | 资源变更时自动重新生成 |
| `flutterGenerateAssets.hoverPreviewEnabled` | `false` | 悬停时显示图片缩略图 |

## 生成结果示例

基于上述配置，插件将生成 `lib/common/assets.dart`：

```dart
// GENERATED CODE — DO NOT MODIFY BY HAND
// ─────────────────────────────────────────────────────────────
//  Flutter Generate Assets
//  VSCode  https://github.com/ceeyang/flutter_generate_assets
//  CLI     https://github.com/ceeyang/generate_assets
// ─────────────────────────────────────────────────────────────
// ignore_for_file: lines_longer_than_80_chars, constant_identifier_names
// dart format off

class Assets {
  static const String imagesLogo = 'assets/images/logo.png';
  static const String imagesBgHome = 'assets/images/bg_home.jpg';
  static const String iconsArrowLeft = 'assets/icons/arrow-left.svg';
}
```

当两个文件同名但扩展名不同时，插件会自动在变量名末尾追加扩展名加以区分：

```dart
// assets/copy_to_clipboard.png + assets/copy_to_clipboard.svg →
static const String copyToClipboardPng = 'assets/copy_to_clipboard.png';
static const String copyToClipboardSvg = 'assets/copy_to_clipboard.svg';
```

## 环境要求

- VSCode 1.85.0 或更高版本
- Flutter 项目，且 `pubspec.yaml` 位于工作区根目录

## 开源协议

MIT
