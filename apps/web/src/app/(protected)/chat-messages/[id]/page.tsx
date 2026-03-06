import { ArrowLeft, MessageSquare, Paperclip } from "lucide-react";
import Link from "next/link";
import { AttachmentList } from "@/components/chat/attachment-list";
import { MentionBadge } from "@/components/chat/mention-badge";
import { ContentWithMentions } from "@/components/chat/rich-content";
import { ThreadView } from "@/components/chat/thread-view";
import { ReclassifyForm } from "@/components/reclassify-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChatMessage, getChatMessages } from "@/lib/api";
import { buildMessageSearchUrl, formatDateTimeJST } from "@/lib/utils";
import { CATEGORY_CONFIG } from "../message-card";
import { AiPanel } from "./ai-panel";
import { ChatOpenButton } from "./chat-open-button";
import { ResponseStatusControl } from "./response-status-control";

interface Props {
  params: Promise<{ id: string }>;
}

function getCategoryLabel(category: string): string {
  return CATEGORY_CONFIG[category]?.label ?? category;
}

function getCategoryPill(category: string): string {
  return CATEGORY_CONFIG[category]?.pill ?? "bg-gray-100 text-gray-600";
}

const METHOD_LABELS: Record<string, string> = {
  ai: "AI (Gemini)",
  regex: "正規表現",
  manual: "手動修正",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export default async function ChatMessageDetailPage({ params }: Props) {
  const { id } = await params;
  const msg = await getChatMessage(id);

  const intent = msg.intent;

  // 同カテゴリの類似メッセージ取得
  const similarMessages = intent
    ? await getChatMessages({ category: intent.category, limit: 6 }).then((res) =>
        res.data.filter((m) => m.id !== id).slice(0, 5),
      )
    : [];

  return (
    <div className="space-y-6">
      {/* パンくず */}
      <Link
        href="/chat-messages"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        チャット分析に戻る
      </Link>

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">メッセージ詳細</h1>
          {msg.messageType === "THREAD_REPLY" && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              ↩ スレッド返信
            </span>
          )}
          {msg.isEdited && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              編集済
            </span>
          )}
        </div>
        {buildMessageSearchUrl(msg.content) && (
          <ChatOpenButton url={buildMessageSearchUrl(msg.content)} />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* メッセージ本文 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">メッセージ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {/* 送信者・日時 */}
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Row label="送信者" value={msg.senderName} />
              <Row label="種別" value={msg.senderType === "HUMAN" ? "ユーザー" : "Bot"} />
              <Row label="日時" value={formatDateTimeJST(msg.createdAt)} />
              <Row
                label="処理日時"
                value={msg.processedAt ? formatDateTimeJST(msg.processedAt) : "未処理"}
              />
            </div>

            {/* メンション */}
            {msg.mentionedUsers.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">メンション</p>
                <div className="flex flex-wrap gap-1.5">
                  {msg.mentionedUsers.map((u) => (
                    <MentionBadge key={u.userId} displayName={u.displayName} />
                  ))}
                </div>
              </div>
            )}

            {/* 本文（メンションインライン対応） */}
            <div className="rounded-md bg-muted p-4 text-base">
              <ContentWithMentions
                formattedContent={msg.formattedContent}
                content={msg.content}
                mentionedUsers={msg.mentionedUsers}
              />
            </div>

            {/* 添付ファイル */}
            {msg.attachments.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Paperclip className="h-3.5 w-3.5" />
                  添付ファイル ({msg.attachments.length}件)
                </p>
                <AttachmentList attachments={msg.attachments} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI 分類 + 推奨アクション */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI 分析</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {intent ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${getCategoryPill(
                      intent.category,
                    )}`}
                  >
                    {getCategoryLabel(intent.category)}
                  </span>
                  {intent.isManualOverride && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      手動修正済
                    </span>
                  )}
                </div>
                {intent.isManualOverride && intent.originalCategory && (
                  <Row label="元のカテゴリ" value={getCategoryLabel(intent.originalCategory)} />
                )}
                {intent.overriddenBy && <Row label="修正者" value={intent.overriddenBy} />}
                {intent.overriddenAt && (
                  <Row label="修正日時" value={formatDateTimeJST(intent.overriddenAt)} />
                )}
                {intent.regexPattern && (
                  <Row
                    label="マッチパターン"
                    value={
                      <code className="rounded bg-muted px-1 text-xs">{intent.regexPattern}</code>
                    }
                  />
                )}
                <div className="border-t border-border/60 pt-3">
                  <AiPanel intent={intent} />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">分類結果がありません</p>
            )}
          </CardContent>
        </Card>

        {/* 手動再分類 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">手動再分類</CardTitle>
          </CardHeader>
          <CardContent>
            <ReclassifyForm chatMessageId={id} currentCategory={intent?.category ?? "other"} />
          </CardContent>
        </Card>

        {/* 対応状況 */}
        {intent && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">対応状況</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponseStatusControl
                chatMessageId={id}
                current={intent.responseStatus}
                updatedBy={intent.responseStatusUpdatedBy}
                updatedAt={intent.responseStatusUpdatedAt}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* スレッドメッセージ（会話ツリー） */}
      {msg.threadMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" />
              スレッド内のメッセージ ({msg.threadMessages.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ThreadView messages={msg.threadMessages} />
          </CardContent>
        </Card>
      )}

      {/* 同カテゴリの類似メッセージ */}
      {similarMessages.length > 0 && intent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              同カテゴリの最近のメッセージ
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {getCategoryLabel(intent.category)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {similarMessages.map((sm) => (
                <Link
                  key={sm.id}
                  href={`/chat-messages/${sm.id}`}
                  className="block rounded-lg border border-border/60 px-4 py-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="line-clamp-1 min-w-0 flex-1 text-sm text-foreground/80">
                      {sm.content}
                    </p>
                    <time className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                      {formatDateTimeJST(sm.createdAt)}
                    </time>
                  </div>
                  {sm.senderName && (
                    <p className="mt-1 text-xs text-muted-foreground">{sm.senderName}</p>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
