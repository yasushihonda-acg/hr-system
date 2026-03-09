import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    watch: false,
    exclude: ["src/**/*.integration.test.ts", "dist/**", "node_modules"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/__tests__/**", "src/**/*.d.ts"],
      thresholds: {
        statements: 50,
        branches: 60,
      },
    },
  },
});
