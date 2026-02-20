/**
 * スレッド会話ツリーコンポーネント
 * 親メッセージ → 返信メッセージのインデント付き会話ビューを表示する。
 */
import { MessageSquare } from "lucide-react";
import { RichContent } from "./rich-content";

interface ThreadMessage {
  id: string;
  senderName: string;
  content: string;
  formattedContent: string | null;
  messageType: "MESSAGE" | "THREAD_REPLY";
  createdAt: string;
}

interface ThreadViewProps {
  messages: ThreadMessage[];
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;
  return date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Avatar({ name }: { name: string }) {
  const initial = name.slice(0, 1);
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {initial}
    </div>
  );
}

function MessageBubble({ message, isReply }: { message: ThreadMessage; isReply: boolean }) {
  return (
    <div
      className={`flex gap-2 ${isReply ? "ml-6 border-l-2 border-muted pl-4" : "border-l-4 border-amber-400 pl-4"}`}
    >
      <Avatar name={message.senderName} />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{message.senderName}</span>
          {isReply && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
          <time className="text-xs text-muted-foreground" title={formatDateTime(message.createdAt)}>
            {formatRelativeTime(message.createdAt)}
          </time>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
          <RichContent formattedContent={message.formattedContent} content={message.content} />
        </div>
      </div>
    </div>
  );
}

export function ThreadView({ messages }: ThreadViewProps) {
  if (messages.length === 0) return null;

  const mainMessages = messages.filter((m) => m.messageType === "MESSAGE");
  const replies = messages.filter((m) => m.messageType === "THREAD_REPLY");

  return (
    <div className="space-y-3">
      {mainMessages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} isReply={false} />
      ))}
      {replies.length > 0 && (
        <div className="space-y-3">
          {replies.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isReply={true} />
          ))}
        </div>
      )}
    </div>
  );
}
