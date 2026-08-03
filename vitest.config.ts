import { defineConfig } from 'vitest/config';

// Tests unitaires de la logique métier pure (packages/domain).
// La couverture est mesurée sur ce périmètre (calculs, droits, validation, garde-fous)
// où l'exactitude est critique ; l'objectif est ≥ 90 %.
export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/domain/src/**/*.ts'],
      exclude: ['**/*.test.ts', 'packages/domain/src/index.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
});
