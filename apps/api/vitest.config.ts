import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 統合テスト (.integration.test.ts) は test:integration スクリプトで個別実行する
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
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
