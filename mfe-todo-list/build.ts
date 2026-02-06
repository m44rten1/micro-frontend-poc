import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/client.ts'],
  bundle: true,
  outfile: 'dist/client.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  define: {
    'process.env.NODE_ENV': '"production"',
    '__VUE_OPTIONS_API__': 'true',
    '__VUE_PROD_DEVTOOLS__': 'false',
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
  },
  sourcemap: true,
});

console.log('[mfe-todo-list] Client bundle built → dist/client.js');
