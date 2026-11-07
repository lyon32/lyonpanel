import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const clientServerImport = {
  patterns: [
    {
      group: ['@/server/*', '@/server/**'],
      message: 'Le code client ne doit jamais importer @/server (secrets, base de données).',
    },
  ],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'graphify-out/**',
  ]),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'import/order': ['error', { 'newlines-between': 'ignore' }],
    },
  },
  {
    // Typage requis pour no-floating-promises
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', clientServerImport] },
  },
  {
    files: ['src/server/**/*.ts'],
    rules: { 'no-console': ['error', { allow: ['error'] }] },
  },
  {
    files: ['tests/**/*.ts'],
    rules: { 'max-lines': 'off' },
  },
]);
