import { Bot, Lightbulb } from "lucide-react";
import type { IntentDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CATEGORY_ACTIONS: Record<string, string[]> = {
  salary: [
    "給与変更ドラフトの確認・作成",
    "職員給与一覧SSへの反映",
    "SmartHRへの反映",
    "社労士への共有",
  ],
  retirement: [
    "退職届の確認",
    "最終給与計算",
    "退職手続きチェックリスト確認",
    "社会保険資格喪失届の準備",
  ],
  hiring: ["入社書類の送付", "SmartHRへの登録", "給与設定", "社会保険取得届の準備"],
  contract: ["契約書の作成・更新", "労働条件通知書の発行", "SmartHRの契約情報更新"],
  transfer: ["異動辞令の発行", "勤務先変更手続き", "通勤手当の再計算"],
  foreigner: ["在留資格の確認", "ビザ更新手続きの案内", "就労制限の確認"],
  training: ["研修スケジュールの調整", "受講者リストの更新", "修了証の発行"],
  health_check: ["健康診断の日程調整", "受診案内の送付", "結果のフォローアップ"],
  attendance: ["勤怠データの確認", "有給残日数の確認", "勤怠修正の対応"],
  other: ["内容の確認・対応方針の検討"],
};

const CONFIDENCE_LABELS: { min: number; label: string; color: string }[] = [
  { min: 0.8, label: "高信頼度", color: "text-[var(--status-ok)]" },
  { min: 0.5, label: "中信頼度", color: "text-[var(--status-warn)]" },
  { min: 0, label: "低信頼度", color: "text-[var(--status-danger)]" },
];

export function getConfidenceLabel(score: number) {
  // biome-ignore lint/style/noNonNullAssertion: 配列の固定インデックスアクセス
  return CONFIDENCE_LABELS.find((l) => score >= l.min) ?? CONFIDENCE_LABELS[2]!;
}

interface AiPanelProps {
  intent: IntentDetail;
}

export function AiPanel({ intent }: AiPanelProps) {
  const conf = getConfidenceLabel(intent.confidenceScore);
  // biome-ignore lint/style/noNonNullAssertion: オブジェクトの固定キーアクセス
  const actions = CATEGORY_ACTIONS[intent.category] ?? CATEGORY_ACTIONS.other!;

  return (
    <div className="space-y-4">
      {/* AI 信頼度 */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-accent shadow-sm">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">AI 分類</span>
            <span className={cn("text-xs font-medium", conf.color)}>
              {conf.label} ({(intent.confidenceScore * 100).toFixed(0)}%)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {intent.classificationMethod === "ai"
              ? "Gemini による自動分類"
              : intent.classificationMethod === "regex"
                ? "正規表現ルールによる分類"
                : "手動分類"}
          </p>
        </div>
      </div>

      {/* 信頼度バー */}
      <div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              intent.confidenceScore >= 0.8
                ? "bg-[var(--status-ok)]"
                : intent.confidenceScore >= 0.5
                  ? "bg-[var(--status-warn)]"
                  : "bg-[var(--status-danger)]",
            )}
            style={{ width: `${intent.confidenceScore * 100}%` }}
          />
        </div>
      </div>

      {/* AI 推論 */}
      {intent.reasoning && (
        <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
          <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            AI の判断理由
          </p>
          <p className="text-xs leading-relaxed text-foreground/80">{intent.reasoning}</p>
        </div>
      )}

      {/* 推奨アクション */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-[var(--status-warn)]" />
          <p className="text-xs font-semibold text-muted-foreground">推奨アクション</p>
        </div>
        <ul className="space-y-1">
          {actions.map((action) => (
            <li key={action} className="flex items-start gap-2 text-xs text-foreground/80">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-[var(--gradient-from)] flex-shrink-0" />
              {action}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
