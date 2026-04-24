import { AssetHoverProvider } from '../hoverProvider';
import * as vscode from 'vscode';
import * as fs from 'fs';

jest.mock('fs');
jest.mock('../pubspecReader', () => ({
  readPubspec: jest.fn(() => ({
    output: 'lib/generated/assets.dart',
    className: 'Assets',
    assetPaths: [],
  })),
}));

const mockExistsSync = fs.existsSync as jest.Mock;
const mockStatSync = fs.statSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;

const GENERATED_CONTENT = [
  "  static const String iconsLogo = 'assets/icons/logo.svg';",
  "  static const String imagesHero = 'assets/images/hero.png';",
].join('\n');

function makeDocument(lineText: string): vscode.TextDocument {
  return {
    lineAt: () => ({ text: lineText }),
  } as unknown as vscode.TextDocument;
}

function makePosition(col = 0): vscode.Position {
  return { line: 0, character: col } as vscode.Position;
}

function setPreviewEnabled(enabled: boolean) {
  (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
    get: jest.fn((key: string, def: unknown) =>
      key === 'hoverPreviewEnabled' ? enabled : def
    ),
  });
}

describe('AssetHoverProvider', () => {
  const provider = new AssetHoverProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() });
    mockReadFileSync.mockReturnValue(GENERATED_CONTENT);
    setPreviewEnabled(false);
  });

  afterEach(() => {
    (vscode.workspace as any).workspaceFolders = undefined;
  });

  // ── generated file line ──────────────────────────────────────

  it('returns undefined when line does not match any pattern', () => {
    const doc = makeDocument('// some comment');
    expect(provider.provideHover(doc, makePosition())).toBeUndefined();
  });

  it('returns undefined when no workspace folder is open', () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    const doc = makeDocument("  static const String imagesLogo = 'assets/images/logo.png';");
    expect(provider.provideHover(doc, makePosition())).toBeUndefined();
  });

  it('resolves generated file line and shows path', () => {
    const doc = makeDocument("  static const String imagesLogo = 'assets/images/logo.png';");
    const hover = provider.provideHover(doc, makePosition());
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).toContain('`assets/images/logo.png`');
  });

  // ── string literal ───────────────────────────────────────────

  it('resolves string literal assets path when cursor is inside it', () => {
    const line = "Image.asset('assets/images/hero.png')";
    // cursor at col 13 — inside the string
    const doc = makeDocument(line);
    const hover = provider.provideHover(doc, makePosition(13));
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).toContain('`assets/images/hero.png`');
  });

  it('returns undefined when cursor is outside a string literal', () => {
    const line = "Image.asset('assets/images/hero.png')";
    // cursor at col 0 — on "Image", not inside the string
    const doc = makeDocument(line);
    expect(provider.provideHover(doc, makePosition(0))).toBeUndefined();
  });

  it('resolves double-quoted string literal', () => {
    const line = 'AssetImage("assets/icons/logo.svg")';
    const doc = makeDocument(line);
    const hover = provider.provideHover(doc, makePosition(12));
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).toContain('`assets/icons/logo.svg`');
  });

  // ── constant reference ───────────────────────────────────────

  it('resolves Assets.varName to asset path via generated file cache', () => {
    const line = 'Image.asset(Assets.iconsLogo)';
    // cursor at col 20 — on "iconsLogo"
    const doc = makeDocument(line);
    const hover = provider.provideHover(doc, makePosition(20));
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).toContain('`assets/icons/logo.svg`');
  });

  it('returns undefined for unknown constant name', () => {
    const line = 'Image.asset(Assets.unknownVar)';
    const doc = makeDocument(line);
    // No match in generated file → falls through all resolvers → undefined
    expect(provider.provideHover(doc, makePosition(20))).toBeUndefined();
  });

  // ── image preview ────────────────────────────────────────────

  it('shows image preview when hoverPreviewEnabled is true', () => {
    setPreviewEnabled(true);
    const doc = makeDocument("  static const String imagesLogo = 'assets/images/logo.png';");
    const hover = provider.provideHover(doc, makePosition());
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).toContain('![preview](assets/images/logo.png)');
  });

  it('omits image preview when hoverPreviewEnabled is false', () => {
    setPreviewEnabled(false);
    const doc = makeDocument("  static const String imagesLogo = 'assets/images/logo.png';");
    const hover = provider.provideHover(doc, makePosition());
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).not.toContain('![preview]');
  });

  it('omits image preview for non-image extensions', () => {
    setPreviewEnabled(true);
    const doc = makeDocument("  static const String fontsBold = 'assets/fonts/bold.ttf';");
    const hover = provider.provideHover(doc, makePosition());
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).not.toContain('![preview]');
  });

  it('omits image preview when file does not exist on disk', () => {
    setPreviewEnabled(true);
    mockExistsSync.mockReturnValue(false);
    const doc = makeDocument("  static const String imagesLogo = 'assets/images/logo.png';");
    const hover = provider.provideHover(doc, makePosition());
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).not.toContain('![preview]');
  });

  it('sets isTrusted and baseUri on the markdown string', () => {
    const doc = makeDocument("  static const String imagesLogo = 'assets/images/logo.png';");
    const hover = provider.provideHover(doc, makePosition());
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.isTrusted).toBe(true);
    expect(md.baseUri).toBeDefined();
  });
});
