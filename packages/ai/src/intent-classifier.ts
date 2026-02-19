import { CHAT_CATEGORIES, type ChatCategory } from "@hr-system/shared";
import { getGenerativeModel } from "./gemini-client.js";
import { INTENT_CLASSIFICATION_PROMPT } from "./prompts.js";

export interface IntentClassificationResult {
  category: ChatCategory;
  confidence: number;
  reasoning: string;
  /** 分類方法: "regex"=正規表現による高確信分類, "ai"=LLMによる分類 */
  classificationMethod: "ai" | "regex";
  /** regex 分類の場合にマッチしたパターン名 */
  regexPattern: string | null;
}

/** 正規表現パターン定義 */
interface RegexRule {
  /** パターン識別名（ログ・学習用） */
  name: string;
  pattern: RegExp;
  category: ChatCategory;
  confidence: number;
}

/**
 * 人事業務の高頻度キーワードに基づく regex ルール。
 * AI 呼び出し前に評価し、confidence >= 0.85 でショートサーキット。
 * パターンは具体的なほうが誤検知を減らせるため、汎用的なものは後回しにする。
 */
const REGEX_RULES: RegexRule[] = [
  // ── 給与・社会保険 ──
  {
    name: "salary_raise",
    pattern: /昇給|給与.*(?:アップ|引き上げ|増額)|ベースアップ|ベア/,
    category: "salary",
    confidence: 0.95,
  },
  {
    name: "salary_cut",
    pattern: /減給|給与.*(?:ダウン|引き下げ|減額)/,
    category: "salary",
    confidence: 0.95,
  },
  {
    name: "salary_change",
    pattern: /給与.*変更|月給.*変更|基本給.*変更|手当.*(?:追加|変更|廃止)/,
    category: "salary",
    confidence: 0.92,
  },
  {
    name: "salary_promotion",
    pattern: /昇格|等級.*変更|号俸/,
    category: "salary",
    confidence: 0.9,
  },
  {
    name: "social_insurance",
    pattern: /社会保険|健康保険|厚生年金|雇用保険|被保険者/,
    category: "salary",
    confidence: 0.88,
  },

  // ── 退職・休職 ──
  {
    name: "retirement",
    pattern: /退職(?:届|申請|手続き|日|予定)|辞職|辞める|離職|退社/,
    category: "retirement",
    confidence: 0.95,
  },
  {
    name: "leave_of_absence",
    pattern: /休職(?:申請|開始|期間|延長)?|育児休業|育休|産休|産前産後休暇|介護休暇/,
    category: "retirement",
    confidence: 0.92,
  },
  {
    name: "reinstatement",
    pattern: /復職(?:予定|手続き|日)?|職場復帰/,
    category: "retirement",
    confidence: 0.9,
  },

  // ── 入社・採用 ──
  {
    name: "hiring",
    pattern: /入社(?:手続き|日|予定|書類)?|採用(?:決定|手続き)|内定|雇い入れ/,
    category: "hiring",
    confidence: 0.93,
  },

  // ── 契約変更 ──
  {
    name: "contract_change",
    pattern: /契約(?:変更|更新|期間|形態)|雇用形態.*変更|正社員(?:転換|登用)|パート.*正社員/,
    category: "contract",
    confidence: 0.9,
  },

  // ── 施設・異動 ──
  {
    name: "transfer",
    pattern: /転勤|異動|配置転換|施設.*(?:変更|移動|転属)|部署.*変更/,
    category: "transfer",
    confidence: 0.9,
  },

  // ── 外国人・ビザ ──
  {
    name: "foreigner",
    pattern: /在留資格|ビザ|外国人.*労働者|就労許可|在留カード|特定技能|技能実習/,
    category: "foreigner",
    confidence: 0.95,
  },

  // ── 健康診断 ──
  {
    name: "health_check",
    pattern: /健康診断|健診|人間ドック|定期健診|産業医/,
    category: "health_check",
    confidence: 0.95,
  },

  // ── 研修・監査 ──
  {
    name: "training",
    pattern: /研修(?:参加|日程|申込)?|監査|実地指導|コンプライアンス.*研修/,
    category: "training",
    confidence: 0.88,
  },

  // ── 勤怠・休暇 ──
  {
    name: "attendance_leave",
    pattern:
      /有給(?:休暇|申請|取得)?|年次有給|休暇(?:申請|取得)|残業(?:申請|承認)|時間外(?:労働|申請)/,
    category: "attendance",
    confidence: 0.93,
  },
  {
    name: "attendance_record",
    pattern: /勤怠(?:修正|確認|入力)|遅刻|早退|欠勤|打刻/,
    category: "attendance",
    confidence: 0.9,
  },
];

/**
 * regex による事前分類を試みる。
 * 最高 confidence のルールをマッチ、閾値 0.85 以上で採用。
 * 複数マッチの場合は confidence が最も高いものを選択。
 */
function tryRegexClassify(message: string): IntentClassificationResult | null {
  let best: { rule: RegexRule; confidence: number } | null = null;

  for (const rule of REGEX_RULES) {
    if (rule.pattern.test(message)) {
      if (!best || rule.confidence > best.confidence) {
        best = { rule, confidence: rule.confidence };
      }
    }
  }

  if (!best || best.confidence < 0.85) return null;

  return {
    category: best.rule.category,
    confidence: best.confidence,
    reasoning: `正規表現パターン "${best.rule.name}" にマッチ`,
    classificationMethod: "regex",
    regexPattern: best.rule.name,
  };
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  return text.trim();
}

/**
 * メッセージを分類する。
 * 1. regex ルールで高確信度マッチ → 即座に返す（AI 呼び出しなし）
 * 2. マッチなし → Gemini で分類
 */
export async function classifyIntent(message: string): Promise<IntentClassificationResult> {
  // regex 事前分類
  const regexResult = tryRegexClassify(message);
  if (regexResult) {
    return regexResult;
  }

  // AI 分類（Gemini）
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
    classificationMethod: "ai",
    regexPattern: null,
  };
}
