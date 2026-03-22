import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Ignore build output, vendored files, generated scripts
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "scripts/fix_test_*",
      "public/**",
      "*.config.*",
      "fix_mocks.cjs",
    ],
  },

  // Base JS recommended rules
  eslint.configs.recommended,

  // TypeScript type-aware rules
  ...tseslint.configs.recommendedTypeChecked,

  // Parser options for type-aware linting
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── Source code rules (src/) ──────────────────────────────────
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      // ── Parameter & complexity limits ──
      "max-params": ["warn", { max: 4 }],
      "complexity": ["warn", { max: 20 }],
      "max-depth": ["warn", { max: 4 }],
      "max-nested-callbacks": ["warn", { max: 3 }],
      "max-lines-per-function": ["warn", { max: 150, skipBlankLines: true, skipComments: true }],

      // ── Type safety ──
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unsafe-assignment": "off", // too noisy with existing code
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/no-unsafe-function-type": "warn",

      // ── Code quality ──
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": "warn",
      "no-throw-literal": "off",
      "@typescript-eslint/only-throw-error": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-unnecessary-condition": "off", // too noisy — 389 defensive checks
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": ["warn", { ignorePrimitives: true }],
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],

      // ── Prevent common bugs ──
      "no-constant-condition": "warn",
      "no-duplicate-case": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "warn",
      "no-unmodified-loop-condition": "warn",
      "no-unreachable-loop": "warn",
      "eqeqeq": ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "off",
      "@typescript-eslint/no-implied-eval": "error",
      "no-new-wrappers": "error",
      "no-return-assign": "error",
      "prefer-const": "warn",

      // ── Readability ──
      "no-lonely-if": "warn",
      "no-unneeded-ternary": "warn",
      "prefer-template": "warn",
      "object-shorthand": "warn",
      "no-else-return": ["warn", { allowElseIf: false }],
      "no-useless-return": "warn",

      // ── Relax some overly strict recommended rules ──
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-redundant-type-constituents": "warn",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "no-case-declarations": "off",
    },
  },

  // ── JSX factory files: `any` and `Function` are inherent to JSX ──
  {
    files: ["src/renderer/jsx.ts", "src/renderer/jsx-types.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
    },
  },

  // ── Test files: relax some rules ─────────────────────────────
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    rules: {
      "max-params": "off",
      "max-lines-per-function": "off",
      "complexity": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-shadow": "off",
      "@typescript-eslint/only-throw-error": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "no-case-declarations": "off",
      "eqeqeq": "off",
      "no-self-compare": "off",
      "prefer-const": "off",
    },
  },
);
