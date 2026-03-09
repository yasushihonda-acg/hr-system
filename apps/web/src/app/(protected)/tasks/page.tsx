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
import { ApiError, getDraft, getDrafts } from "@/lib/api";
import { formatCurrency } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { DraftSidePanel } from "./draft-side-panel";

interface Props {
  searchParams: Promise<{ status?: DraftStatus; page?: string; id?: string }>;
}

const PAGE_SIZE = 20;

export default async function TasksPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const selectedId = params.id ?? null;

  const [{ drafts, total }, selectedDraft] = await Promise.all([
    getDrafts({
      status: params.status,
      limit: PAGE_SIZE,
      offset,
    }),
    selectedId
      ? getDraft(selectedId).catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 404) return null;
          console.error("Failed to fetch draft:", err);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(overrides: { status?: string; page?: string; id?: string }) {
    const sp = new URLSearchParams();
    const s = "status" in overrides ? overrides.status : params.status;
    const p = overrides.page ?? params.page;
    const id = "id" in overrides ? overrides.id : params.id;
    if (s) sp.set("status", s);
    if (p && p !== "1") sp.set("page", p);
    if (id) sp.set("id", id);
    const qs = sp.toString();
    return `/tasks${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex h-[calc(100vh-52px)] -m-6">
      {/* 左: テーブル */}
      <div className={cn("flex-1 overflow-y-auto p-6", selectedDraft && "hidden lg:block")}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">承認一覧</h1>
            <p className="text-sm text-muted-foreground">全{total}件</p>
          </div>

          {/* フィルタ */}
          <div className="flex gap-2">
            <FilterLink
              href={buildUrl({ status: undefined })}
              label="すべて"
              active={!params.status}
            />
            <FilterLink
              href={buildUrl({ status: "draft" })}
              label="ドラフト"
              active={params.status === "draft"}
            />
            <FilterLink
              href={buildUrl({ status: "reviewed" })}
              label="レビュー済"
              active={params.status === "reviewed"}
            />
            <FilterLink
              href={buildUrl({ status: "pending_ceo_approval" })}
              label="社長承認待ち"
              active={params.status === "pending_ceo_approval"}
            />
            <FilterLink
              href={buildUrl({ status: "approved" })}
              label="承認済"
              active={params.status === "approved"}
            />
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
                      承認ドラフトがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  drafts.map((d) => (
                    <TableRow
                      key={d.id}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-accent/50",
                        d.id === selectedId && "bg-accent",
                      )}
                    >
                      <TableCell>
                        <Link href={buildUrl({ id: d.id })}>
                          <StatusBadge status={d.status} />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={buildUrl({ id: d.id })} className="block">
                          {d.changeType === "mechanical" ? "機械的" : "裁量的"}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        <Link href={buildUrl({ id: d.id })} className="block">
                          {d.reason}
                        </Link>
                      </TableCell>
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
                <Link href={buildUrl({ page: String(page - 1) })}>前へ</Link>
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
                <Link href={buildUrl({ page: String(page + 1) })}>次へ</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 右: サイドパネル */}
      {selectedDraft && (
        <div className="w-full lg:w-[420px] flex-shrink-0 overflow-hidden">
          <DraftSidePanel draft={selectedDraft} />
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
