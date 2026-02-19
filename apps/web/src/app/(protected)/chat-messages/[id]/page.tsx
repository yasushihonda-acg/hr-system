import { ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";
import { ReclassifyForm } from "@/components/reclassify-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChatMessage } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
}

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
  ai: "AI (Gemini)",
  regex: "正規表現",
  manual: "手動修正",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP");
}

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
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">メッセージ詳細</h1>
        {msg.messageType === "THREAD_REPLY" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            スレッド返信
          </span>
        )}
        {msg.isEdited && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            編集済
          </span>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* メッセージ本文 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">メッセージ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md bg-muted p-4 text-base leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Row label="送信者" value={msg.senderName} />
              <Row label="種別" value={msg.senderType === "HUMAN" ? "ユーザー" : "Bot"} />
              <Row label="日時" value={formatDateTime(msg.createdAt)} />
              <Row
                label="処理日時"
                value={msg.processedAt ? formatDateTime(msg.processedAt) : "未処理"}
              />
            </div>
            {msg.mentionedUsers.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">メンション: </span>
                {msg.mentionedUsers.map((u) => u.displayName).join(", ")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI 分類結果 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">分類結果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {intent ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      CATEGORY_COLORS[intent.category] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {CATEGORY_LABELS[intent.category] ?? intent.category}
                  </span>
                  {intent.isManualOverride && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      手動修正済
                    </span>
                  )}
                </div>
                <Row
                  label="分類方法"
                  value={METHOD_LABELS[intent.classificationMethod] ?? intent.classificationMethod}
                />
                <Row label="信頼度" value={`${(intent.confidenceScore * 100).toFixed(1)}%`} />
                {intent.regexPattern && (
                  <Row
                    label="マッチパターン"
                    value={
                      <code className="rounded bg-muted px-1 text-xs">{intent.regexPattern}</code>
                    }
                  />
                )}
                {intent.reasoning && (
                  <div>
                    <p className="text-muted-foreground">AI 推論</p>
                    <p className="mt-1 rounded-md bg-muted p-2 text-xs leading-relaxed">
                      {intent.reasoning}
                    </p>
                  </div>
                )}
                {intent.isManualOverride && intent.originalCategory && (
                  <Row
                    label="元のカテゴリ"
                    value={CATEGORY_LABELS[intent.originalCategory] ?? intent.originalCategory}
                  />
                )}
                {intent.overriddenBy && <Row label="修正者" value={intent.overriddenBy} />}
                {intent.overriddenAt && (
                  <Row label="修正日時" value={formatDateTime(intent.overriddenAt)} />
                )}
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
      </div>

      {/* スレッドメッセージ */}
      {msg.threadMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" />
              スレッド内のメッセージ ({msg.threadMessages.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {msg.threadMessages.map((t) => (
                <div key={t.id} className="rounded-md border p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{t.senderName}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(t.createdAt)}
                      {t.messageType === "THREAD_REPLY" && (
                        <span className="ml-1 text-muted-foreground">↩</span>
                      )}
                    </span>
                  </div>
                  <p className="leading-relaxed text-muted-foreground">{t.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
