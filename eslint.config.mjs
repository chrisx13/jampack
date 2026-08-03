import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Configuration ESLint (flat) du monorepo. Volontairement pragmatique : elle sert de garde-fou
// (variables inutilisées, erreurs manifestes) sans imposer le typage strict. `any` est toléré
// (usages volontaires aux frontières tRPC/Prisma), les directives de désactivation ne sont pas
// signalées comme inutilisées.
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/migrations/**', '**/coverage/**', '**/*.config.*', 'apps/desktop/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);
