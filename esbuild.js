// Trois bundles : l'extension (Node), le hook de désinstallation (Node)
// et le moteur injecté dans workbench.html (navigateur, IIFE).
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const common = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  logLevel: 'info',
};

const configs = [
  {
    ...common,
    entryPoints: ['src/extension/extension.ts'],
    outfile: 'dist/extension.js',
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    external: ['vscode'],
  },
  {
    ...common,
    entryPoints: ['src/extension/uninstall.ts'],
    outfile: 'dist/uninstall.js',
    platform: 'node',
    format: 'cjs',
    target: 'node18',
  },
  {
    ...common,
    entryPoints: ['src/injected/main.ts'],
    outfile: 'dist/injected.js',
    platform: 'browser',
    format: 'iife',
    target: 'chrome110',
    sourcemap: false,
  },
];

async function main() {
  if (watch) {
    const ctxs = await Promise.all(configs.map((c) => esbuild.context(c)));
    await Promise.all(ctxs.map((c) => c.watch()));
    console.log('[esbuild] watching…');
  } else {
    await Promise.all(configs.map((c) => esbuild.build(c)));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
