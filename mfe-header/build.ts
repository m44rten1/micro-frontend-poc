import * as esbuild from 'esbuild';

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
