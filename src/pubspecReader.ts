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
