import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.expo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Metro bundles images and SVGs only through static require() calls.
    files: ['apps/mobile/src/components/Icon.tsx'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
