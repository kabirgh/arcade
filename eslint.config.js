import js from "@eslint/js";
import tseslint from "typescript-eslint";
import simpleImportSort from "eslint-plugin-simple-import-sort";

export default tseslint.config({
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  files: ["**/*.{ts,tsx}"],
  languageOptions: {
    ecmaVersion: 2020,
    parser: tseslint.parser,
    parserOptions: {
      project: ["./tsconfig.json"],
    },
  },
  plugins: {
    "simple-import-sort": simpleImportSort,
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
  },
});
