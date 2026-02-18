import type { DraftStatus } from "@hr-system/shared";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDrafts } from "@/lib/api";

interface Props {
  searchParams: Promise<{ status?: DraftStatus; page?: string }>;
}

const PAGE_SIZE = 20;

function formatCurrency(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP");
}

export default async function DraftsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { drafts, total } = await getDrafts({
    status: params.status,
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">給与ドラフト一覧</h1>
        <p className="text-sm text-muted-foreground">全{total}件</p>
      </div>

      {/* フィルタ */}
      <div className="flex gap-2">
        <FilterLink href="/" label="すべて" active={!params.status} />
        <FilterLink href="/?status=draft" label="ドラフト" active={params.status === "draft"} />
        <FilterLink
          href="/?status=reviewed"
          label="レビュー済"
          active={params.status === "reviewed"}
        />
        <FilterLink
          href="/?status=pending_ceo_approval"
          label="社長承認待ち"
          active={params.status === "pending_ceo_approval"}
        />
        <FilterLink href="/?status=approved" label="承認済" active={params.status === "approved"} />
      </div>

      {/* テーブル */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ステータス</TableHead>
              <TableHead>変更種別</TableHead>
              <TableHead>理由</TableHead>
              <TableHead className="text-right">変更前</TableHead>
              <TableHead className="text-right">変更後</TableHead>
              <TableHead>適用日</TableHead>
              <TableHead>作成日</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  ドラフトがありません
                </TableCell>
              </TableRow>
            ) : (
              drafts.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link href={`/drafts/${d.id}`}>
                      <StatusBadge status={d.status} />
                    </Link>
                  </TableCell>
                  <TableCell>{d.changeType === "mechanical" ? "機械的" : "裁量的"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{d.reason}</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.beforeTotal)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(d.afterTotal)}</TableCell>
                  <TableCell>{formatDate(d.effectiveDate)}</TableCell>
                  <TableCell>{formatDate(d.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            <Link
              href={`/?${new URLSearchParams({ ...(params.status ? { status: params.status } : {}), page: String(page - 1) })}`}
            >
              前へ
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
            <Link
              href={`/?${new URLSearchParams({ ...(params.status ? { status: params.status } : {}), page: String(page + 1) })}`}
            >
              次へ
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Button variant={active ? "default" : "outline"} size="sm" asChild>
      <Link href={href}>{label}</Link>
    </Button>
  );
}
