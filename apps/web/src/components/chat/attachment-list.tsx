/**
 * 添付ファイルリストコンポーネント
 */
import { FileText, HardDrive } from "lucide-react";

interface Attachment {
  name: string;
  contentName?: string;
  contentType?: string;
  downloadUri?: string;
  source?: "DRIVE_FILE" | "UPLOADED_CONTENT";
}

interface AttachmentListProps {
  attachments: Attachment[];
  /** 添付ファイルクリック時の遷移先 Google Chat メッセージ URL。downloadUri が認証を要求する場合のフォールバック。 */
  chatUrl?: string;
}

export function AttachmentList({ attachments, chatUrl }: AttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="space-y-1">
      {attachments.map((att) => (
        <div
          key={att.name}
          className="flex items-center gap-2 rounded-md border border-muted bg-muted/40 px-3 py-2 text-sm"
        >
          {att.source === "DRIVE_FILE" ? (
            <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          {chatUrl ? (
            <a
              href={chatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 truncate text-primary hover:underline"
              title="Google Chat でファイルを開く"
            >
              {att.contentName ?? att.name}
            </a>
          ) : att.downloadUri ? (
            <a
              href={att.downloadUri}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 truncate text-primary hover:underline"
            >
              {att.contentName ?? att.name}
            </a>
          ) : (
            <span className="flex-1 truncate text-foreground">{att.contentName ?? att.name}</span>
          )}
          {att.contentType && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {att.contentType.split("/").pop()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
