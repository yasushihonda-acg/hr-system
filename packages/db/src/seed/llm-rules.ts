import type { ChatCategory } from "@hr-system/shared";

export const INITIAL_LLM_RULES: Array<{
  type: "system_prompt" | "few_shot_example" | "category_definition";
  content: string | null;
  category: ChatCategory | null;
  description: string | null;
  keywords: string[] | null;
  inputText: string | null;
  expectedCategory: ChatCategory | null;
  explanation: string | null;
  priority: number;
}> = [
  {
    type: "system_prompt",
    content: `あなたは人事業務の専門家です。以下のチャットメッセージを分析し、適切なカテゴリに分類してください。

## カテゴリ一覧
- salary: 給与・社会保険に関する内容（昇給、減給、手当変更、社会保険手続き等）
- retirement: 退職・休職に関する内容（退職届、休職申請、復職等）
- hiring: 入社・採用に関する内容（新規採用、入社手続き等）
- contract: 契約変更に関する内容（雇用形態変更、契約更新等）
- transfer: 施設・異動に関する内容（配置転換、転勤等）
- foreigner: 外国人・ビザに関する内容（在留資格、ビザ更新等）
- training: 研修・監査に関する内容（研修参加、監査対応等）
- health_check: 健康診断に関する内容（健診予約、結果管理等）
- attendance: 勤怠・休暇に関する内容（有給申請、勤怠修正等）
- other: 上記のいずれにも該当しない内容

## 回答形式
必ず以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。

{"category": "カテゴリ名", "confidence": 0.0〜1.0の数値, "reasoning": "分類理由"}`,
    category: null,
    description: "メイン分類プロンプト",
    keywords: null,
    inputText: null,
    expectedCategory: null,
    explanation: null,
    priority: 1,
  },
  {
    type: "few_shot_example",
    content: null,
    category: null,
    description: "給与変更のFew-shot例",
    keywords: null,
    inputText: "最低賃金改定に伴う時給変更をお願いします",
    expectedCategory: "salary",
    explanation: "最低賃金改定に伴う時給変更は給与カテゴリに該当",
    priority: 10,
  },
  {
    type: "few_shot_example",
    content: null,
    category: null,
    description: "退職のFew-shot例",
    keywords: null,
    inputText: "山田さんが3月末で退職予定です。退職届の手続きをお願いします",
    expectedCategory: "retirement",
    explanation: "退職届の手続きは退職・休職カテゴリに該当",
    priority: 11,
  },
  {
    type: "few_shot_example",
    content: null,
    category: null,
    description: "入社のFew-shot例",
    keywords: null,
    inputText: "来月入社予定の佐藤さんのオリエンテーション準備をお願いします",
    expectedCategory: "hiring",
    explanation: "入社オリエンテーションの準備は入社・採用カテゴリに該当",
    priority: 12,
  },
  {
    type: "few_shot_example",
    content: null,
    category: null,
    description: "その他のFew-shot例",
    keywords: null,
    inputText: "お疲れ様です。明日の会議の件、確認お願いします",
    expectedCategory: "other",
    explanation: "人事業務に直接関連しない一般的な業務連絡はその他カテゴリに該当",
    priority: 20,
  },
];
