import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import path from 'path';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    cssInjectedByJsPlugin(),
  ],
  resolve: {
    // ローカル開発サーバー(dev)の時のみローカルshimを使用、ビルド時はexternalとしてブラウザのimportmapに委譲
    alias: command === 'serve' ? {
      'flow-sdk': path.resolve(__dirname, './src/flow-sdk-shim.ts'),
    } : {},
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
      // flow-sdk は Google Flow Tools プレビュー(iframe)の importmap に完全委譲
      external: ['flow-sdk'],
      output: {
        entryFileNames: 'bundle.js',
        format: 'es',
        inlineDynamicImports: true,
      },
    },
  },
}));
