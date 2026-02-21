import type { ClassificationConfig } from "@hr-system/ai";
import { loadClassificationConfig } from "@hr-system/db";

const TTL_MS = 5 * 60 * 1000; // 5分
let cache: { config: ClassificationConfig; loadedAt: number } | null = null;

/**
 * Firestore の分類ルールから ClassificationConfig を構築する。
 * TTL 5分のインメモリキャッシュ付き。
 */
export async function getClassificationConfig(): Promise<ClassificationConfig> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.config;

  const loaded = await loadClassificationConfig();
  const config: ClassificationConfig = {
    regexRules: loaded.regexRules,
    systemPrompt: loaded.systemPrompt,
    fewShotExamples: loaded.fewShotExamples,
  };
  cache = { config, loadedAt: Date.now() };
  return config;
}

/** キャッシュをクリアする（テスト用） */
export function clearConfigCache(): void {
  cache = null;
}
