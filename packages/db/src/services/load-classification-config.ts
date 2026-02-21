import type { ChatCategory } from "@hr-system/shared";
import { collections } from "../collections.js";

/** RegexRule 互換型（@hr-system/ai の RegexRule と同じ構造） */
export interface LoadedRegexRule {
  name: string;
  pattern: RegExp;
  category: ChatCategory;
  confidence: number;
}

/** Few-shot example */
export interface LoadedFewShotExample {
  input: string;
  category: ChatCategory;
  explanation: string;
}

/** @hr-system/ai の ClassificationConfig と互換の型 */
export interface LoadedClassificationConfig {
  regexRules?: LoadedRegexRule[];
  systemPrompt?: string;
  fewShotExamples?: LoadedFewShotExample[];
}

/**
 * Firestore の classification_rules + llm_classification_rules から
 * ClassificationConfig 互換のオブジェクトを構築する。
 * Worker（キャッシュ付き）と API（テスト分類）の両方から使用。
 */
export async function loadClassificationConfig(): Promise<LoadedClassificationConfig> {
  // 1. classification_rules → RegexRule[] に変換
  const rulesSnap = await collections.classificationRules
    .where("isActive", "==", true)
    .orderBy("priority", "asc")
    .get();

  const regexRules: LoadedRegexRule[] = [];
  for (const doc of rulesSnap.docs) {
    const d = doc.data();
    for (const kw of d.keywords) {
      regexRules.push({
        name: `${d.category}_kw_${kw}`,
        pattern: new RegExp(kw),
        category: d.category,
        confidence: Math.max(0.8, d.confidenceScore - 0.05),
      });
    }
    for (const pat of d.patterns) {
      regexRules.push({
        name: `${d.category}_pat`,
        pattern: new RegExp(pat),
        category: d.category,
        confidence: d.confidenceScore,
      });
    }
  }

  // 2. llm_classification_rules → systemPrompt + fewShotExamples
  const llmSnap = await collections.llmClassificationRules
    .where("isActive", "==", true)
    .orderBy("priority", "asc")
    .get();

  let systemPrompt: string | undefined;
  const fewShotExamples: LoadedFewShotExample[] = [];
  for (const doc of llmSnap.docs) {
    const d = doc.data();
    if (d.type === "system_prompt" && d.content) {
      systemPrompt = d.content;
    }
    if (d.type === "few_shot_example" && d.inputText && d.expectedCategory) {
      fewShotExamples.push({
        input: d.inputText,
        category: d.expectedCategory,
        explanation: d.explanation ?? "",
      });
    }
  }

  return {
    regexRules: regexRules.length > 0 ? regexRules : undefined,
    systemPrompt,
    fewShotExamples: fewShotExamples.length > 0 ? fewShotExamples : undefined,
  };
}
