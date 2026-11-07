import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Suite dédiée à la base locale : séquentielle, car les tests partagent la même base.
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/db/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30000,
    env: loadEnv(mode, process.cwd(), ''),
  },
}));
