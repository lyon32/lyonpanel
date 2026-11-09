import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Sert uniquement à exécuter les scripts du catalogue avec les vraies fonctions du projet
// (alias « @ », TypeScript) sans ajouter de bibliothèque.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    include: ['scripts/catalogue/*.script.ts'],
    environment: 'node',
    testTimeout: 600000,
  },
});
