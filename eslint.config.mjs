import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginAstro from 'eslint-plugin-astro';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.astro/**',
      '.wrangler/**',
      'build/**',
      '.output/**',
      'coverage/**',
      'Reference/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,astro}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
      'react/prop-types': 'off',
    },
  }
];
