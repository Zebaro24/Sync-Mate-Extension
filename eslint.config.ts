import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "@eslint-react/eslint-plugin";
import prettierPlugin from "eslint-plugin-prettier";
import * as tsParser from "@typescript-eslint/parser";

export default [
    {
        files: ["**/*.{ts,tsx,mts}"],
        languageOptions: {
            globals: globals.browser,
            parser: tsParser,
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            prettier: prettierPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            "prettier/prettier": [
                "error",
                {
                    tabWidth: 4,
                    useTabs: false,
                },
            ],
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-unused-expressions": "off",
            "@typescript-eslint/consistent-type-imports": "error",
        },
    },

    {
        files: ["src/entrypoints/popup/**/*.{ts,tsx}"],
        ...reactPlugin.configs.recommended,
        languageOptions: {
            parser: tsParser,
        },
        rules: {
            "@eslint-react/no-array-index-key": "off",
            "@eslint-react/hooks-extra/no-redundant-custom-hook": "off",
            "@eslint-react/dom/no-missing-button-type": "off",
            "@eslint-react/hooks-extra/prefer-use-state-lazy-initialization":
                "off",
            "@eslint-react/no-unstable-context-value": "off",
        },
    },

    {
        ignores: ["**/.output/*", "**/.wxt/*", "**/.idea/*"],
    },
];
