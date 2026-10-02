import { createHash } from 'node:crypto';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  css: {
    modules: {
      generateScopedName: (name: string, filename: string) => `c${createHash('sha1').update(`${filename}:${name}`).digest('hex').slice(0, 7)}`,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
      '/ads': 'http://localhost:3000',
      '/analytics': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
