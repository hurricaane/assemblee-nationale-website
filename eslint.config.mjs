// @ts-check
import antfu from "@antfu/eslint-config";

import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  antfu(
    {
      vue: { a11y: true },
      formatters: { css: true },
      stylistic: {
        semi: true,
        quotes: "double",
      },
      ignores: ["**/*.md"],
    },
    {
      rules: {
        "vue/max-attributes-per-line": [
          "error",
          {
            singleline: { max: 2 },
            multiline: { max: 1 },
          },
        ],
        "ts/consistent-type-definitions": ["error", "type"],
        "no-console": "warn",
        "antfu/no-top-level-await": "off",
        "node/prefer-global/process": "off",
        "node/no-process-env": "error",
        "unicorn/filename-case": [
          "error",
          {
            cases: { kebabCase: true, camelCase: true, pascalCase: true },
          },
        ],
      },
    },
  ),
);
