import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const contentClient = fileURLToPath(
  new URL('../../packages/content/src/client.ts', import.meta.url),
);

export default defineConfig({
  appType: 'spa',
  plugins: [react()],
  resolve: {
    alias: {
      '@codeblin/content/client': contentClient,
    },
  },
  optimizeDeps: {
    exclude: ['@codeblin/content'],
    include: ['mermaid'],
  },
  server: {
    port: 4322,
    host: 'localhost',
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4323',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4322,
    host: '127.0.0.1',
  },
});
