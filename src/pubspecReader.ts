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
  const generateAssets = (doc?.flutter_generate_assets as Record<string, unknown>) ?? {};

  const rawAssets = flutter?.assets;

  return {
    output: typeof generateAssets.output === 'string'
      ? generateAssets.output
      : 'lib/generated/assets.dart',
    className: typeof generateAssets.class_name === 'string'
      ? generateAssets.class_name
      : 'Assets',
    assetPaths: Array.isArray(rawAssets) ? (rawAssets as string[]) : [],
  };
}
