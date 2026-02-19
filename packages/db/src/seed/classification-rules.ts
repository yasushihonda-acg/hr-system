import type { ChatCategory } from "@hr-system/shared";

export const INITIAL_CLASSIFICATION_RULES: Array<{
  category: ChatCategory;
  keywords: string[];
  excludeKeywords: string[];
  patterns: string[];
  priority: number;
  description: string;
  sampleMessages: string[];
}> = [
  {
    category: "salary",
    keywords: [
      "給与",
      "時給",
      "月給",
      "賃金",
      "最低賃金",
      "手当",
      "社会保険",
      "住民税",
      "給与明細",
      "昇給",
      "減給",
      "資格手当",
      "地域手当",
      "役職手当",
    ],
    excludeKeywords: [],
    patterns: ["時給.*変更", "給与.*改定", "手当.*追加"],
    priority: 1,
    description:
      "最低賃金改定に伴う時給変更、給与明細の発行、社会保険の加入・脱退手続き、住民税の特別徴収切り替えなど（66件実績）",
    sampleMessages: [
      "最低賃金改定に伴う時給変更をお願いします",
      "給与明細の発行をお願いいたします",
      "住民税の特別徴収切り替えについて",
    ],
  },
  {
    category: "retirement",
    keywords: [
      "退職",
      "休職",
      "復職",
      "退職届",
      "退職金",
      "離職票",
      "退職手続き",
      "備品回収",
      "産休",
      "育休",
    ],
    excludeKeywords: [],
    patterns: ["退職.*届", "休職.*手続", "復職.*条件"],
    priority: 2,
    description:
      "従業員の退職届の受理、退職に伴う備品回収の確認、休職手続きや復職に伴う条件変更など（45件実績）",
    sampleMessages: [
      "退職届の受理をお願いします",
      "備品回収の確認をお願いいたします",
      "休職手続きについて相談です",
    ],
  },
  {
    category: "hiring",
    keywords: [
      "入社",
      "採用",
      "面接",
      "応募",
      "求人",
      "オリエンテーション",
      "内定",
      "試用期間",
      "中途採用",
      "新卒",
    ],
    excludeKeywords: [],
    patterns: ["面接.*日程", "入社.*手続", "採用.*決定"],
    priority: 3,
    description:
      "求人への応募対応、面接日程の調整、入社オリエンテーションの準備、採用決定後の初動対応など（38件実績）",
    sampleMessages: [
      "応募があったので面接日程の調整をお願いします",
      "入社オリエンテーションの準備をお願いします",
    ],
  },
  {
    category: "contract",
    keywords: [
      "契約",
      "労働条件",
      "条件通知書",
      "雇用契約",
      "契約更新",
      "職種変更",
      "契約変更",
      "労働条件通知書",
    ],
    excludeKeywords: [],
    patterns: ["契約.*更新", "条件.*変更", "雇用契約.*締結"],
    priority: 5,
    description:
      "労働条件通知書の作成・締結、雇用契約の更新、職種変更に伴う契約の巻き直しなど（22件実績）",
    sampleMessages: ["労働条件通知書の作成をお願いします", "雇用契約の更新手続きについて"],
  },
  {
    category: "transfer",
    keywords: ["異動", "移転", "拠点", "寮", "社用車", "備品", "施設", "事務所", "配属"],
    excludeKeywords: [],
    patterns: ["異動.*拠点", "移転.*対応", "寮.*準備"],
    priority: 6,
    description:
      "拠点の移転対応、寮の準備、社用車の修理・廃車手続き、人事異動に伴う拠点間の調整など（12件実績）",
    sampleMessages: [
      "博多駅南ビルへの移転対応をお願いします",
      "早良区有田七丁目の寮の準備について",
    ],
  },
  {
    category: "foreigner",
    keywords: ["外国人", "特定技能", "ビザ", "入管", "在留資格", "実習生", "技能実習", "引越し"],
    excludeKeywords: [],
    patterns: ["特定技能.*届出", "ビザ.*更新", "在留.*資格"],
    priority: 7,
    description:
      "特定技能実習生の入管届出、ビザ更新申請の準備、外国人職員の生活サポートなど（12件実績）",
    sampleMessages: ["特定技能実習生の入管届出をお願いします", "ビザ更新申請の準備について"],
  },
  {
    category: "training",
    keywords: ["研修", "監査", "事務手続き", "証明書", "就労証明書", "身体拘束", "行政監査"],
    excludeKeywords: [],
    patterns: ["研修.*実施", "監査.*準備", "証明書.*発行"],
    priority: 8,
    description:
      "身体拘束廃止などの研修実施、行政監査の準備資料作成、就労証明書などの各種書類発行など（9件実績）",
    sampleMessages: ["身体拘束廃止研修の実施について", "行政監査の準備資料を作成してください"],
  },
  {
    category: "health_check",
    keywords: ["健康診断", "面談", "産業医", "定期健診", "人間ドック", "メンタルヘルス"],
    excludeKeywords: [],
    patterns: ["健康診断.*予約", "面談.*実施", "産業医.*面談"],
    priority: 9,
    description: "定期健康診断の予約管理、産業医や人事担当者による個別面談の実施など（8件実績）",
    sampleMessages: ["定期健康診断の予約管理をお願いします", "産業医面談の実施について"],
  },
  {
    category: "attendance",
    keywords: ["勤怠", "休暇", "シフト", "有給", "特別休暇", "遅刻", "早退", "欠勤", "残業"],
    excludeKeywords: [],
    patterns: ["勤怠.*入力", "シフト.*確認", "有給.*取得"],
    priority: 10,
    description:
      "勤怠管理システムの入力ルール調整、シフトの確認、有給休暇や特別休暇の取得相談など（5件実績）",
    sampleMessages: ["勤怠管理システムの入力ルールについて", "有給休暇の取得相談です"],
  },
  {
    category: "other",
    keywords: [],
    excludeKeywords: [],
    patterns: [],
    priority: 99,
    description: "特定のキーワードに該当しない個別の相談事項や、単発の連絡事項など（34件実績）",
    sampleMessages: [],
  },
];
