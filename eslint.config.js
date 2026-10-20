// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Architecture §4/§8: the domain layer is pure TypeScript.
    files: ["src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-native", "react-native/*", "expo", "expo-*", "drizzle-orm", "drizzle-orm/*"],
              message: "src/domain is pure TS: no React, React Native, Expo or Drizzle imports.",
            },
            {
              group: ["@/services/*", "@/data/*", "@/state/*", "@/components/*"],
              message: "src/domain must not import services, data, state or UI.",
            },
          ],
        },
      ],
    },
  },
  {
    // Architecture §8. Profiles, the seed config, and tests may name a language.
    files: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    ignores: [
      "src/domain/language/profiles/**",
      "src/data/seed/**",
      "src/content/sample-lesson.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value='es'], Literal[value='es-MX'], Literal[value='es-ES']",
          message: "Language tags belong in a language profile, content/, or the default course seed.",
        },
      ],
    },
  },
]);
