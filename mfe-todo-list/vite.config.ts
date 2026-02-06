import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'src/client.ts'),
      output: {
        format: 'iife',
        dir: 'dist',
        entryFileNames: 'client.js',
        inlineDynamicImports: true,
      },
    },
    sourcemap: true,
    copyPublicDir: false,
  },
  define: {
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
});
