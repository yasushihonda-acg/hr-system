import Link from "next/link";
import { ContentWithMentions, stripHtml } from "@/components/chat/rich-content";
import { ChatSyncButton } from "@/components/chat/sync-button";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getChatMessages, getStatsSpaces } from "@/lib/api";

interface Props {
  searchParams: Promise<{
    category?: string;
    messageType?: "MESSAGE" | "THREAD_REPLY";
    spaceId?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 30;

const CATEGORY_LABELS: Record<string, string> = {
  salary: "給与・社保",
  retirement: "退職・休職",
  hiring: "入社・採用",
  contract: "契約変更",
  transfer: "施設・異動",
  foreigner: "外国人・ビザ",
  training: "研修・監査",
  health_check: "健康診断",
  attendance: "勤怠・休暇",
  other: "その他",
};

const CATEGORY_COLORS: Record<string, string> = {
  salary: "bg-green-100 text-green-800",
  retirement: "bg-red-100 text-red-800",
  hiring: "bg-blue-100 text-blue-800",
  contract: "bg-yellow-100 text-yellow-800",
  transfer: "bg-purple-100 text-purple-800",
  foreigner: "bg-orange-100 text-orange-800",
  training: "bg-indigo-100 text-indigo-800",
  health_check: "bg-pink-100 text-pink-800",
  attendance: "bg-teal-100 text-teal-800",
  other: "bg-gray-100 text-gray-600",
};

const METHOD_LABELS: Record<string, string> = {
  ai: "AI",
  regex: "正規表現",
  manual: "手動",
};

const METHOD_COLORS: Record<string, string> = {
  ai: "bg-violet-100 text-violet-800",
  regex: "bg-cyan-100 text-cyan-800",
  manual: "bg-amber-100 text-amber-800",
};

const RESPONSE_STATUS_LABELS: Record<string, string> = {
  unresponded: "未対応",
  in_progress: "対応中",
  responded: "対応済",
  not_required: "対応不要",
};

const RESPONSE_STATUS_COLORS: Record<string, string> = {
  unresponded: "bg-red-100 text-red-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  responded: "bg-green-100 text-green-800",
  not_required: "bg-gray-100 text-gray-600",
};

/** スペースIDをフレンドリー名に変換 */
const SPACE_NAMES: Record<string, string> = {
  "AAAA-qf5jX0": "人事関連(全社共通)",
};

function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category] ?? category;
  const color = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const label = METHOD_LABELS[method] ?? method;
  const color = METHOD_COLORS[method] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function ResponseStatusBadge({ status }: { status: string }) {
  const label = RESPONSE_STATUS_LABELS[status] ?? status;
  const color = RESPONSE_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ChatMessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [{ data: messages, pagination }, spacesData] = await Promise.all([
    getChatMessages({
      category: params.category,
      messageType: params.messageType,
      spaceId: params.spaceId,
      limit: PAGE_SIZE,
      offset,
    }),
    getStatsSpaces(),
  ]);

  function buildUrl(overrides: {
    category?: string;
    messageType?: string;
    spaceId?: string;
    page?: string;
  }) {
    const sp = new URLSearchParams();
    const category = "category" in overrides ? overrides.category : params.category;
    const messageType = "messageType" in overrides ? overrides.messageType : params.messageType;
    const spaceId = "spaceId" in overrides ? overrides.spaceId : params.spaceId;
    const p = overrides.page;
    if (category) sp.set("category", category);
    if (messageType) sp.set("messageType", messageType);
    if (spaceId) sp.set("spaceId", spaceId);
    if (p && p !== "1") sp.set("page", p);
    const qs = sp.toString();
    return `/chat-messages${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">チャット分析</h1>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {pagination.hasMore
              ? `${offset + messages.length}件以上`
              : `${offset + messages.length}件`}
          </p>
          <ChatSyncButton />
        </div>
      </div>

      {/* スペースフィルタ */}
      {spacesData.spaces.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">スペース</p>
          <div className="flex flex-wrap gap-2">
            <FilterLink
              href={buildUrl({ spaceId: undefined, page: "1" })}
              label="すべて"
              active={!params.spaceId}
            />
            {spacesData.spaces.map(({ spaceId, count }) => (
              <FilterLink
                key={spaceId}
                href={buildUrl({ spaceId, page: "1" })}
                label={`${SPACE_NAMES[spaceId] ?? spaceId} (${count}件)`}
                active={params.spaceId === spaceId}
              />
            ))}
          </div>
        </div>
      )}

      {/* カテゴリフィルタ */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">カテゴリ</p>
        <div className="flex flex-wrap gap-2">
          <FilterLink
            href={buildUrl({ category: undefined, page: "1" })}
            label="すべて"
            active={!params.category}
          />
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <FilterLink
              key={value}
              href={buildUrl({ category: value, page: "1" })}
              label={label}
              active={params.category === value}
            />
          ))}
        </div>
      </div>

      {/* 投稿種別フィルタ */}
      <div className="flex gap-2">
        <FilterLink
          href={buildUrl({ messageType: undefined, page: "1" })}
          label="全投稿"
          active={!params.messageType}
        />
        <FilterLink
          href={buildUrl({ messageType: "MESSAGE", page: "1" })}
          label="通常投稿"
          active={params.messageType === "MESSAGE"}
        />
        <FilterLink
          href={buildUrl({ messageType: "THREAD_REPLY", page: "1" })}
          label="スレッド返信"
          active={params.messageType === "THREAD_REPLY"}
        />
      </div>

      {/* テーブル */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">日時</TableHead>
              <TableHead className="w-[100px]">投稿者</TableHead>
              <TableHead>メッセージ</TableHead>
              <TableHead className="w-[110px]">カテゴリ</TableHead>
              <TableHead className="w-[90px]">分類方法</TableHead>
              <TableHead className="w-[70px]">信頼度</TableHead>
              <TableHead className="w-[90px]">対応状況</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  メッセージがありません
                </TableCell>
              </TableRow>
            ) : (
              messages.map((msg) => {
                const preview = msg.formattedContent
                  ? stripHtml(msg.formattedContent)
                  : msg.content;
                return (
                  <TableRow
                    key={msg.id}
                    className={`cursor-pointer hover:bg-muted/50 ${msg.messageType === "THREAD_REPLY" ? "border-l-2 border-amber-400" : ""}`}
                  >
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      <Link href={`/chat-messages/${msg.id}`} className="block">
                        {formatDateTime(msg.createdAt)}
                        {msg.messageType === "THREAD_REPLY" && (
                          <span className="ml-1 text-[10px] text-amber-600">↩ 返信</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[100px] truncate text-sm">
                      <Link href={`/chat-messages/${msg.id}`} className="block">
                        {msg.senderName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/chat-messages/${msg.id}`} className="block">
                        <div className="max-w-[400px]">
                          {msg.isEdited && (
                            <span className="text-xs text-muted-foreground">[編集済] </span>
                          )}
                          <ContentWithMentions
                            content={preview}
                            formattedContent={null}
                            className="line-clamp-2 text-sm"
                          />
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {msg.intent ? (
                        <CategoryBadge category={msg.intent.category} />
                      ) : (
                        <span className="text-xs text-muted-foreground">未分類</span>
                      )}
                      {msg.intent?.isManualOverride && (
                        <span className="ml-1 text-[10px] text-amber-600">修正済</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {msg.intent && <MethodBadge method={msg.intent.classificationMethod} />}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {msg.intent ? `${(msg.intent.confidenceScore * 100).toFixed(0)}%` : "-"}
                    </TableCell>
                    <TableCell>
                      {msg.intent ? (
                        <ResponseStatusBadge status={msg.intent.responseStatus} />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ページネーション */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" asChild disabled={page <= 1}>
          <Link href={buildUrl({ page: String(page - 1) })}>前へ</Link>
        </Button>
        <span className="text-sm text-muted-foreground">ページ {page}</span>
        <Button variant="outline" size="sm" asChild disabled={!pagination.hasMore}>
          <Link href={buildUrl({ page: String(page + 1) })}>次へ</Link>
        </Button>
      </div>
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
