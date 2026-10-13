import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  ignorePatterns: core.ignorePatterns,
  // Node event APIs and browser animation frames require callback/Promise bridges.
  rules: {
    "promise/avoid-new": "off",
    "promise/prefer-await-to-callbacks": "off",
    "promise/prefer-await-to-then": "off",
    "func-style": ["error", "declaration", { allowArrowFunctions: true }],
    "sort-keys": "off",
    "unicorn/import-style": "off",
    "unicorn/no-await-expression-member": "off",
  },
  overrides: [
    {
      files: ["tests/**"],
      rules: {
        "no-bitwise": "off",
        "no-nested-ternary": "off",
        "typescript/no-non-null-assertion": "off",
      },
    },
  ],
});
