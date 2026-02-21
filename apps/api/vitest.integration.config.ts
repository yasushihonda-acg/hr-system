import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 統合テストファイルのみを対象にする
    include: ["src/**/*.integration.test.ts"],
    environment: "node",
    // エミュレータへの接続競合を避けるため、シングルプロセスで順次実行する
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
