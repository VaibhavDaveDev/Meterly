import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";

// Type-aware lint rules (tseslint.configs.recommendedTypeChecked) require
// parserOptions.project and a compatible tsconfig. Enabling them on an
// Astro + Cloudflare Workers project surfaces hundreds of findings that
// need incremental remediation. Deferred — see CONTRIBUTING.md.
// TODO: Enable type-aware rules once the codebase reaches stable lint-clean state.

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".astro/**",
      ".wrangler/**",
      "build/**",
      ".output/**",
      "coverage/**",
      "Reference/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,astro}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
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
        version: "detect",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/no-unescaped-entities": "off",
      "react/prop-types": "off",
    },
  },
];
