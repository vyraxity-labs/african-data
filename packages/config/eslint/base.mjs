import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";

export const baseConfig = [
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];

export default baseConfig;
