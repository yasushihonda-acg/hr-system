import { CHAT_CATEGORIES, type ChatCategory } from "@hr-system/shared";
import { getGenerativeModel } from "./gemini-client.js";
import { INTENT_CLASSIFICATION_PROMPT } from "./prompts.js";

export interface IntentClassificationResult {
  category: ChatCategory;
  confidence: number;
  reasoning: string;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  return text.trim();
}

export async function classifyIntent(message: string): Promise<IntentClassificationResult> {
  const model = getGenerativeModel();
  const response = await model.generateContent({
    contents: [
      { role: "user", parts: [{ text: INTENT_CLASSIFICATION_PROMPT }] },
      {
        role: "model",
        parts: [{ text: "理解しました。チャットメッセージをJSON形式で分類します。" }],
      },
      { role: "user", parts: [{ text: message }] },
    ],
  });

  const text = response.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error(`Intent classification failed: invalid JSON response: ${text}`);
  }

  const result = parsed as Record<string, unknown>;

  if (
    typeof result.category !== "string" ||
    !CHAT_CATEGORIES.includes(result.category as ChatCategory)
  ) {
    throw new Error(`Intent classification failed: invalid category "${result.category}"`);
  }

  const confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));

  return {
    category: result.category as ChatCategory,
    confidence,
    reasoning: String(result.reasoning ?? ""),
  };
}
