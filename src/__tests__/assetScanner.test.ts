import { scanAssets } from '../assetScanner';
import * as fs from 'fs';

jest.mock('fs');

const mockExistsSync = fs.existsSync as jest.Mock;
const mockStatSync = fs.statSync as jest.Mock;
const mockReaddirSync = fs.readdirSync as jest.Mock;

function dir(name: string): fs.Dirent {
  return { name, isDirectory: () => true, isFile: () => false } as fs.Dirent;
}
function file(name: string): fs.Dirent {
  return { name, isDirectory: () => false, isFile: () => true } as fs.Dirent;
}

describe('scanAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true });
  });

  it('collects files from a declared directory', () => {
    mockReaddirSync.mockReturnValue([file('logo.png'), file('bg.jpg')]);
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result).toContain('assets/images/logo.png');
    expect(result).toContain('assets/images/bg.jpg');
  });

  it('skips 2x resolution subdirectory', () => {
    mockReaddirSync.mockImplementation((d: string) => {
      if (d.endsWith('images')) return [file('logo.png'), dir('2x')];
      return [];
    });
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result).toContain('assets/images/logo.png');
    expect(result.some(r => r.includes('/2x/'))).toBe(false);
  });

  it('skips 3x resolution subdirectory', () => {
    mockReaddirSync.mockImplementation((d: string) => {
      if (d.endsWith('images')) return [file('icon.png'), dir('3x')];
      return [];
    });
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result.some(r => r.includes('/3x/'))).toBe(false);
  });

  it('skips 1.5x resolution subdirectory', () => {
    mockReaddirSync.mockImplementation((d: string) => {
      if (d.endsWith('images')) return [file('icon.png'), dir('1.5x')];
      return [];
    });
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result.some(r => r.includes('/1.5x/'))).toBe(false);
  });

  it('recurses into non-resolution subdirectories', () => {
    mockReaddirSync.mockImplementation((d: string) => {
      if (d.endsWith('images')) return [dir('buttons')];
      if (d.endsWith('buttons')) return [file('play.png')];
      return [];
    });
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result).toContain('assets/images/buttons/play.png');
  });

  it('skips paths that do not exist on disk', () => {
    mockExistsSync.mockReturnValue(false);
    const result = scanAssets('/workspace', ['assets/missing/']);
    expect(result).toEqual([]);
  });

  it('handles multiple declared asset paths', () => {
    mockReaddirSync.mockImplementation((d: string) => {
      if (d.endsWith('images')) return [file('logo.png')];
      if (d.endsWith('icons')) return [file('arrow.svg')];
      return [];
    });
    const result = scanAssets('/workspace', ['assets/images/', 'assets/icons/']);
    expect(result).toContain('assets/images/logo.png');
    expect(result).toContain('assets/icons/arrow.svg');
  });

  it('skips a directory when readdirSync throws', () => {
    mockReaddirSync.mockImplementation((d: string) => {
      if (d.endsWith('images')) return [file('logo.png'), dir('protected')];
      if (d.endsWith('protected')) throw new Error('EACCES: permission denied');
      return [];
    });
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result).toContain('assets/images/logo.png');
    // 'protected' subdir is skipped, no crash
    expect(result.some(r => r.includes('protected'))).toBe(false);
  });

  it('skips .DS_Store and other hidden files', () => {
    mockReaddirSync.mockReturnValue([
      file('logo.png'),
      file('.DS_Store'),
      file('Thumbs.db'),
      file('desktop.ini'),
      file('.gitkeep'),
    ]);
    const result = scanAssets('/workspace', ['assets/images/']);
    expect(result).toContain('assets/images/logo.png');
    expect(result).not.toContain('assets/images/.DS_Store');
    expect(result).not.toContain('assets/images/Thumbs.db');
    expect(result).not.toContain('assets/images/desktop.ini');
    expect(result).not.toContain('assets/images/.gitkeep');
  });

  it('includes a directly declared file (non-directory path)', () => {
    mockStatSync.mockReturnValue({ isDirectory: () => false });
    const result = scanAssets('/workspace', ['assets/images/logo.png']);
    expect(result).toContain('assets/images/logo.png');
  });

  it('deduplicates when a file is declared both via directory and explicitly', () => {
    mockStatSync.mockImplementation((p: string) => ({
      isDirectory: () => !p.endsWith('.svg'),
    }));
    mockReaddirSync.mockReturnValue([file('ic_red_packet_detail.svg')]);
    // assets/icons/ (directory) + assets/icons/ic_red_packet_detail.svg (explicit)
    const result = scanAssets('/workspace', [
      'assets/icons/',
      'assets/icons/ic_red_packet_detail.svg',
    ]);
    const count = result.filter(r => r === 'assets/icons/ic_red_packet_detail.svg').length;
    expect(count).toBe(1);
  });
});
