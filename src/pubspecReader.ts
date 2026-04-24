import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface PubspecConfig {
  output: string;
  className: string;
  assetPaths: string[];
  stripPrefixes: string[];
}

export function readPubspec(workspaceRoot: string): PubspecConfig {
  const pubspecPath = path.join(workspaceRoot, 'pubspec.yaml');
  const content = fs.readFileSync(pubspecPath, 'utf-8');
  const doc = yaml.load(content) as Record<string, unknown>;

  const flutter = (doc?.flutter as Record<string, unknown>) ?? {};
  const cfg = (doc?.flutter_generate_assets as Record<string, unknown>) ?? {};

  const rawAssets = flutter?.assets;
  const rawStrip = cfg.strip_prefix;

  let stripPrefixes: string[];
  if (Array.isArray(rawStrip)) {
    stripPrefixes = rawStrip.map(String);
  } else if (typeof rawStrip === 'string') {
    stripPrefixes = [rawStrip];
  } else {
    stripPrefixes = ['assets/'];
  }

  return {
    output: typeof cfg.output === 'string' ? cfg.output : 'lib/generated/assets.dart',
    className: typeof cfg.class_name === 'string' ? cfg.class_name : 'Assets',
    assetPaths: Array.isArray(rawAssets) ? (rawAssets as string[]) : [],
    stripPrefixes,
  };
}
