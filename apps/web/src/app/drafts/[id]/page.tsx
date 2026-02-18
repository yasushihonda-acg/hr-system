import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { TransitionButtons } from "@/components/transition-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDraft } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
}

function formatCurrency(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP");
}

export default async function DraftDetailPage({ params }: Props) {
  const { id } = await params;
  const draft = await getDraft(id);

  const diff = draft.afterTotal - draft.beforeTotal;
  const diffSign = diff > 0 ? "+" : "";

  return (
    <div className="space-y-6">
      {/* パンくず */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">ドラフト詳細</h1>
          <StatusBadge status={draft.status} />
        </div>
      </div>

      {/* 承認操作 */}
      <TransitionButtons draftId={id} nextActions={draft.nextActions} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* 基本情報 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="変更種別" value={draft.changeType === "mechanical" ? "機械的" : "裁量的"} />
            <Row label="理由" value={draft.reason} />
            <Row label="適用日" value={formatDate(draft.effectiveDate)} />
            <Row label="作成日時" value={formatDateTime(draft.createdAt)} />
            <Row label="更新日時" value={formatDateTime(draft.updatedAt)} />
            {draft.reviewedBy && <Row label="レビュー者" value={draft.reviewedBy} />}
            {draft.approvedBy && <Row label="承認者" value={draft.approvedBy} />}
          </CardContent>
        </Card>

        {/* 金額比較 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">給与変更</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead className="text-right">変更前</TableHead>
                  <TableHead className="text-right">変更後</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">基本給</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(draft.beforeBaseSalary)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(draft.afterBaseSalary)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">総額</TableCell>
                  <TableCell className="text-right">{formatCurrency(draft.beforeTotal)}</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(draft.afterTotal)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">差額</TableCell>
                  <TableCell />
                  <TableCell
                    className={`text-right font-bold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}
                  >
                    {diffSign}
                    {formatCurrency(diff)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* AI 情報 */}
      {(draft.aiConfidence !== null || draft.aiReasoning) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI 分析</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {draft.aiConfidence !== null && (
              <Row label="信頼度" value={`${(draft.aiConfidence * 100).toFixed(0)}%`} />
            )}
            {draft.aiReasoning && <Row label="推論" value={draft.aiReasoning} />}
            {draft.appliedRules.length > 0 && (
              <Row label="適用ルール" value={draft.appliedRules.join(", ")} />
            )}
          </CardContent>
        </Card>
      )}

      {/* 承認履歴 */}
      {draft.approvalLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">承認履歴</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>遷移</TableHead>
                  <TableHead>操作者</TableHead>
                  <TableHead>コメント</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.approvalLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>
                      <StatusBadge status={log.fromStatus} />
                      <span className="mx-1">→</span>
                      <StatusBadge status={log.toStatus} />
                    </TableCell>
                    <TableCell>{log.actorEmail}</TableCell>
                    <TableCell>{log.comment ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
