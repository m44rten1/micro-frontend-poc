import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    ssr: 'src/render.ts',
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        format: 'cjs',
        entryFileNames: 'server.cjs',
      },
    },
  },
  ssr: {
    // Bundle everything so the output is self-contained
    noExternal: true,
  },
  define: {
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
});
