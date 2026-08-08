import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import security from 'eslint-plugin-security';

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
  // SAST statique (offline) : jeu de règles à fort signal / peu de faux positifs. On n'active PAS
  // les règles bruyantes (detect-object-injection, detect-non-literal-regexp/fs) qui signaleraient
  // des accès par crochet et nos `new RegExp` légitimes. On garde les patterns réellement dangereux.
  {
    plugins: { security },
    rules: {
      'security/detect-child-process': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-unsafe-regex': 'error',        // ReDoS
      'security/detect-buffer-noassert': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-bidi-characters': 'error',
    },
  },
);
