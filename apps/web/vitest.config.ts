import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    watch: false,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**", // Playwright E2E テストを vitest から除外
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/__tests__/**", "src/**/*.d.ts"],
      thresholds: {}, // UIコンポーネント中心のため閾値なし
    },
  },
});
