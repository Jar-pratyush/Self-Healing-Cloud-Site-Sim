import js from "@eslint/js";
import globals from "globals";
import react_hooks from "eslint-plugin-react-hooks";
import react_refresh from "eslint-plugin-react-refresh";
import ts_eslint from "typescript-eslint";

// Naming rule for the whole codebase: snake_case for every identifier.
// Two exceptions are forced by React itself: components are PascalCase
// (JSX treats lowercase tags as HTML elements) and hooks start with "use"
// in camelCase (the hooks lint rule only recognises that shape).
// Type names stay PascalCase, which is the TypeScript convention.
const naming_rule = [
  "error",
  { selector: "default", format: ["snake_case"], leadingUnderscore: "allow" },
  { selector: "variable", format: ["snake_case", "UPPER_CASE"] },
  { selector: "variable", modifiers: ["destructured"], format: null },
  { selector: "function", format: ["snake_case", "PascalCase"] },
  { selector: "function", filter: { regex: "^use[A-Z]", match: true }, format: ["camelCase"] },
  { selector: "typeLike", format: ["PascalCase"] },
  // Object literal keys and methods are often dictated by browser or library
  // APIs (rootMargin, assetsInlineLimit, transformIndexHtml). Our own shapes
  // are still checked through the typeProperty selector covered by "default".
  { selector: "objectLiteralProperty", format: null },
  { selector: "objectLiteralMethod", format: null },
  { selector: "import", format: null },
];

export default ts_eslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...ts_eslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": react_hooks,
      "react-refresh": react_refresh,
    },
    rules: {
      ...react_hooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/naming-convention": naming_rule,
    },
  },
  {
    files: ["scripts/**/*.mjs", "eslint.config.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
);
