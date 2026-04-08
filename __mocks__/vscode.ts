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
    baseUri: unknown = undefined;
    appendMarkdown(s: string) { this.value += s; return this; }
  },
  Uri: {
    file: jest.fn((p: string) => ({
      fsPath: p,
      toString: () => `file:///${p.replace(/\\/g, '/').replace(/^\//, '')}`,
    })),
  },
  Disposable: class {
    constructor(private fn: () => void) {}
    dispose() { this.fn(); }
    static from(...items: { dispose(): unknown }[]) {
      return new (this as any)(() => items.forEach(i => i.dispose()));
    }
  },
};

module.exports = vscode;
