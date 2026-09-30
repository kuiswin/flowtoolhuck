import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin(),
  ],
  resolve: {
    alias: {
      // 内部コードの import { Flow } from 'flow-sdk' はすべて shim (window.Flow参照Proxy) に接続
      'flow-sdk': path.resolve(__dirname, './src/flow-sdk-shim.ts'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    lib: {
      entry: path.resolve(__dirname, 'src/index.tsx'),
      name: 'FlowTool',
      formats: ['es'],
      fileName: () => 'bundle.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'bundle.js',
        format: 'es',
        inlineDynamicImports: true,
      },
      external: [],
    },
  },
});
