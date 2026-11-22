import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
    // Trop de workers en parallèle font échouer le démarrage (« Failed to start forks worker »).
    maxWorkers: 4,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    // next-intl importe « next/navigation » sans extension : vite doit le résoudre.
    server: { deps: { inline: ['next-intl'] } },
    // Les tests de composants ajoutent `// @vitest-environment jsdom` en tête de fichier.
    setupFiles: ['tests/helpers/setup-ui.ts'],
  },
});
