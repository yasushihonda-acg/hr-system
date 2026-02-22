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
}

/** ファイル名で Google Chat 検索するURL。クリックするとファイルが含まれるメッセージが表示される。 */
function buildSearchUrl(filename: string): string {
  return `https://mail.google.com/chat/u/0/#search/${encodeURIComponent(filename)}/cmembership=1`;
}

export function AttachmentList({ attachments }: AttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="space-y-1">
      {attachments.map((att) => {
        const displayName = att.contentName ?? att.name;
        const href = buildSearchUrl(displayName);
        return (
          <div
            key={att.name}
            className="flex items-center gap-2 rounded-md border border-muted bg-muted/40 px-3 py-2 text-sm"
          >
            {att.source === "DRIVE_FILE" ? (
              <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 truncate text-primary hover:underline"
              title="Google Chat でファイルを検索して開く"
            >
              {displayName}
            </a>
            {att.contentType && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {att.contentType.split("/").pop()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
