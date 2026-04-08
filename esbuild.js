const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

const ctx = esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
});

ctx.then(async (c) => {
  if (isWatch) {
    await c.watch();
    console.log('watching...');
  } else {
    await c.rebuild();
    await c.dispose();
  }
}).catch((err) => { console.error(err); process.exit(1); });
