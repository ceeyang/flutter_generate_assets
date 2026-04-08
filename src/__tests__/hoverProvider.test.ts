import { AssetHoverProvider } from '../hoverProvider';
import * as vscode from 'vscode';
import * as fs from 'fs';

jest.mock('fs');

const mockExistsSync = fs.existsSync as jest.Mock;

function makeDocument(lineText: string): vscode.TextDocument {
  return {
    lineAt: () => ({ text: lineText }),
  } as unknown as vscode.TextDocument;
}

function makePosition(): vscode.Position {
  return { line: 0, character: 0 } as vscode.Position;
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
    (vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/workspace' } },
    ];
    mockExistsSync.mockReturnValue(true);
    setPreviewEnabled(false); // default: preview off
  });

  afterEach(() => {
    (vscode.workspace as any).workspaceFolders = undefined;
  });

  it('returns undefined when line does not match pattern', () => {
    const doc = makeDocument('// some comment');
    expect(provider.provideHover(doc, makePosition())).toBeUndefined();
  });

  it('returns undefined when no workspace folder is open', () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    const doc = makeDocument("  static const String imagesLogo = 'assets/images/logo.png';");
    expect(provider.provideHover(doc, makePosition())).toBeUndefined();
  });

  it('omits image preview when hoverPreviewEnabled is false (default)', () => {
    setPreviewEnabled(false);
    const doc = makeDocument("  static const String imagesLogo = 'assets/images/logo.png';");
    const hover = provider.provideHover(doc, makePosition());
    expect(hover).toBeDefined();
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).not.toContain('![preview]');
    expect(md.value).toContain('`assets/images/logo.png`');
  });

  it('shows image preview when hoverPreviewEnabled is true', () => {
    setPreviewEnabled(true);
    const doc = makeDocument("  static const String imagesLogo = 'assets/images/logo.png';");
    const hover = provider.provideHover(doc, makePosition());
    expect(hover).toBeDefined();
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).toContain('![preview](assets/images/logo.png)');
    expect(md.value).toContain('`assets/images/logo.png`');
  });

  it('returns hover with only path for non-image extensions', () => {
    setPreviewEnabled(true);
    const doc = makeDocument("  static const String fontsBold = 'assets/fonts/bold.ttf';");
    const hover = provider.provideHover(doc, makePosition());
    expect(hover).toBeDefined();
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).not.toContain('![preview]');
    expect(md.value).toContain('`assets/fonts/bold.ttf`');
  });

  it('omits image when file does not exist on disk', () => {
    setPreviewEnabled(true);
    mockExistsSync.mockReturnValue(false);
    const doc = makeDocument("  static const String imagesLogo = 'assets/images/logo.png';");
    const hover = provider.provideHover(doc, makePosition());
    expect(hover).toBeDefined();
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.value).not.toContain('![preview]');
    expect(md.value).toContain('`assets/images/logo.png`');
  });

  it('sets isTrusted and baseUri on the markdown string', () => {
    const doc = makeDocument("  static const String imagesLogo = 'assets/images/logo.png';");
    const hover = provider.provideHover(doc, makePosition());
    const md = (hover as any).contents as InstanceType<typeof vscode.MarkdownString>;
    expect(md.isTrusted).toBe(true);
    expect(md.baseUri).toBeDefined();
  });
});
