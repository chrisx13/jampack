import { defineConfig } from 'vitest/config';

// Tests d'intégration des routeurs tRPC contre une vraie base PostgreSQL
// (via appRouter.createCaller). Exécution SÉQUENTIELLE (base partagée).
// Nécessite DATABASE_URL + une base migrée & seedée.
export default defineConfig({
  test: {
    include: ['apps/api/src/**/*.int.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
