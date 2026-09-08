import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      jsxA11y.flatConfigs.recommended,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Our API layer and test doubles intentionally type some boundaries as `unknown`
      // and narrow at runtime; `any` would hide real mistakes there, so we keep this on
      // rather than disabling it project-wide.
      '@typescript-eslint/no-explicit-any': 'error',

      // Enabled deliberately: unused vars/imports are the most common leftover from
      // AI-assisted scaffolding and are cheap for the linter to catch before review.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // We destructure props heavily; requiring a return type on every small
      // component/handler added more noise than value for this size of app.
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    // Test files run under Vitest/jsdom (describe/it/expect globals via globals.vitest
    // is not a real thing, so we just widen the global set instead).
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  prettierConfig,
);
