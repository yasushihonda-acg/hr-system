export const INTENT_CLASSIFICATION_PROMPT = `あなたは人事業務の専門家です。以下のチャットメッセージを分析し、適切なカテゴリに分類してください。

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

{"category": "カテゴリ名", "confidence": 0.0〜1.0の数値, "reasoning": "分類理由"}`;

export const SALARY_PARAM_EXTRACTION_PROMPT = `あなたは人事業務の専門家です。以下の給与変更に関するチャットメッセージから、必要なパラメータを抽出してください。

## 変更タイプの判断基準
- mechanical（機械的変更）: 資格取得、等級変更、法令改正など、規定に基づく定型的な変更
- discretionary（裁量的変更）: 昇給、減給、個別の金額指定など、裁量が伴う変更

## 回答形式
必ず以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。

{"employeeIdentifier": "従業員名または番号（不明の場合はnull）", "changeType": "mechanical または discretionary", "targetSalary": 目標金額の数値（不明の場合はnull）, "allowanceType": "手当種別（position/region/qualification、該当なしの場合はnull）", "reasoning": "抽出理由"}

## 注意事項
- 金額は数値に変換してください（例: 「30万」→ 300000、「25万円」→ 250000）
- 従業員名から敬称（さん、様等）は除去してください
- 不明な項目はnullとしてください`;
