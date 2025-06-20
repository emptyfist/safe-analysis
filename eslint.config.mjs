import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // Base configuration for all files
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
    },
  },
  
  // TypeScript-specific configuration
  {
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript-specific rules
      "@typescript-eslint/no-unused-vars": ["error", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-var-requires": "error",
      
      // Import rules to enforce alias usage
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["^(\\./|\\.\\./).*types$"],
              message: "Use '@/types' alias instead of relative path"
            },
            {
              group: ["^(\\./|\\.\\./).*config$"],
              message: "Use '@/config' alias instead of relative path"
            },
            {
              group: ["^(\\./|\\.\\./).*"],
              message: "Use '@/path' alias instead of relative path when possible"
            }
          ]
        }
      ],
      
      // General code quality rules
      "prefer-const": "error",
      "no-var": "error",
      "no-console": "off", // Allow console.log for CLI tool
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-unused-expressions": "error",
      "no-unreachable": "error",
      "no-constant-condition": "error",
      "no-empty": "error",
      "no-extra-semi": "error",
      "no-irregular-whitespace": "error",
      "no-trailing-spaces": "error",
      "prefer-template": "error",
      "quotes": ["error", "single", { "avoidEscape": true }],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      "indent": ["error", 2],
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "never"],
      "space-before-blocks": "error",
      "space-before-function-paren": ["error", {
        "anonymous": "always",
        "named": "never",
        "asyncArrow": "always"
      }],
      "space-in-parens": ["error", "never"],
      "space-infix-ops": "error",
      "space-unary-ops": ["error", { "words": true, "nonwords": false }],
    },
  },
  
  // Configuration for test files (if any)
  {
    files: ["**/*.test.{js,ts}", "**/*.spec.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  
  // Configuration for configuration files
  {
    files: ["*.config.{js,mjs,cjs,ts,mts,cts}", ".*rc.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
