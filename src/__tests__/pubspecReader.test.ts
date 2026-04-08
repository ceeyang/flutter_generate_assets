import { readPubspec } from '../pubspecReader';
import * as fs from 'fs';

jest.mock('fs');

const mockReadFileSync = fs.readFileSync as jest.Mock;

describe('readPubspec', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
      '/my/project/pubspec.yaml',
      'utf-8'
    );
  });
});
