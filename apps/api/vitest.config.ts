import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 統合テスト (.integration.test.ts) は test:integration スクリプトで個別実行する
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
  },
});
