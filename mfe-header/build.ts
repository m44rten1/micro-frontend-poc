import * as esbuild from 'esbuild';

// ── Client bundle (IIFE, runs in browser) ──

await esbuild.build({
  entryPoints: ['src/client.tsx'],
  bundle: true,
  outfile: 'dist/client.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  jsxImportSource: 'react',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  sourcemap: true,
});

console.log('[mfe-header] Client bundle built → dist/client.js');

// ── Server bundle (CJS, self-contained, exports render function) ──

await esbuild.build({
  entryPoints: ['src/render.tsx'],
  bundle: true,
  outfile: 'dist/server.cjs',
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  jsx: 'automatic',
  jsxImportSource: 'react',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  // Bundle all dependencies so the output is self-contained
  packages: 'bundle',
});

console.log('[mfe-header] Server bundle built → dist/server.cjs');
