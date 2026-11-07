import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
    // Les tests de composants ajoutent `// @vitest-environment jsdom` en tête de fichier.
    setupFiles: ['tests/helpers/setup-ui.ts'],
  },
});
