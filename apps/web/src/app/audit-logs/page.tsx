import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAuditLogs } from "@/lib/api";

interface Props {
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 30;

const EVENT_LABELS: Record<string, string> = {
  chat_received: "チャット受信",
  intent_classified: "意図分類",
  draft_created: "ドラフト作成",
  draft_modified: "ドラフト修正",
  status_changed: "ステータス変更",
  notification_sent: "通知送信",
  external_sync: "外部連携",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP");
}

export default async function AuditLogsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { logs, total } = await getAuditLogs({ limit: PAGE_SIZE, offset });
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">監査ログ</h1>
        <p className="text-sm text-muted-foreground">全{total}件</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日時</TableHead>
              <TableHead>イベント</TableHead>
              <TableHead>対象</TableHead>
              <TableHead>操作者</TableHead>
              <TableHead>ロール</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  ログがありません
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{EVENT_LABELS[log.eventType] ?? log.eventType}</Badge>
                  </TableCell>
                  <TableCell>
                    {log.entityType === "SalaryDraft" ? (
                      <Link href={`/drafts/${log.entityId}`} className="text-primary underline">
                        {log.entityId.slice(0, 8)}...
                      </Link>
                    ) : (
                      <span className="font-mono text-xs">{log.entityId.slice(0, 8)}...</span>
                    )}
                  </TableCell>
                  <TableCell>{log.actorEmail}</TableCell>
                  <TableCell>{log.actorRole}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            <Link href={`/audit-logs?page=${page - 1}`}>前へ</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
            <Link href={`/audit-logs?page=${page + 1}`}>次へ</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
