/**
 * リッチテキストコンテンツコンポーネント
 * formattedContent（Google Chat のHTMLマークアップ）を安全にレンダリングする。
 *
 * Google Chat の formattedText は限定的なタグのみを含む:
 *   <b>, <i>, <strike>, <font color="...">, <a href="...">, <br>, <pre>, <ul>, <li>
 * DOMPurify 相当のサニタイズを独自実装する（外部依存を避けるため）。
 */
import { MentionBadge } from "./mention-badge";

interface RichContentProps {
  /** リッチテキスト（HTML形式）。null の場合は content フォールバック */
  formattedContent: string | null;
  /** プレーンテキスト（formattedContent がない場合に使用） */
  content: string;
}

const ALLOWED_TAGS = new Set([
  "b",
  "i",
  "strike",
  "s",
  "del",
  "a",
  "br",
  "pre",
  "ul",
  "li",
  "font",
  "span",
]);
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href"],
  font: ["color"],
  span: ["style"],
};

/**
 * HTML をサニタイズして許可タグ・属性のみ残す（簡易版）。
 * サーバーサイドで実行されるため、DOMParser は使えない。
 * 正規表現ベースの簡易サニタイザ（Google Chat の限定HTMLを対象とした実用的な実装）。
 */
function sanitizeHtml(html: string): string {
  // タグを許可リストでフィルタリング
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*)?)\s*\/?>/g, (match, tag, attrs) => {
    const lowerTag = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(lowerTag)) return "";

    const isClosing = match.startsWith("</");
    if (isClosing) return `</${lowerTag}>`;

    const allowedAttrs = ALLOWED_ATTRS[lowerTag] ?? [];
    let safeAttrs = "";
    for (const attr of allowedAttrs) {
      const attrMatch = attrs.match(new RegExp(`${attr}="([^"]*)"`, "i"));
      if (attrMatch) {
        // href は http/https/mailto のみ許可
        if (attr === "href") {
          const href = attrMatch[1];
          if (!/^(https?:|mailto:)/i.test(href)) continue;
        }
        safeAttrs += ` ${attr}="${attrMatch[1]}"`;
      }
    }

    return `<${lowerTag}${safeAttrs}>`;
  });
}

/** Google Chat のフォーマット済みテキストをプレーンテキストに変換 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export function RichContent({ formattedContent, content }: RichContentProps) {
  if (formattedContent) {
    const safeHtml = sanitizeHtml(formattedContent);
    return (
      <div
        className="leading-relaxed [&_a]:text-primary [&_a]:underline [&_b]:font-bold [&_i]:italic [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs [&_s]:line-through [&_strike]:line-through [&_ul]:list-inside [&_ul]:list-disc"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized above
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return <div className="whitespace-pre-wrap leading-relaxed">{content}</div>;
}

/**
 * メンションをインラインバッジで表示するコンテンツコンポーネント。
 * プレーンテキスト内の @数字.名前 パターンを MentionBadge に変換する。
 * formattedContent がある場合は RichContent と同じHTML表示にフォールバックする。
 */
export function ContentWithMentions({
  content,
  formattedContent,
  className,
}: RichContentProps & { className?: string }) {
  if (formattedContent) {
    const safeHtml = sanitizeHtml(formattedContent);
    return (
      <div
        className={`leading-relaxed [&_a]:text-primary [&_a]:underline [&_b]:font-bold [&_i]:italic [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs [&_s]:line-through [&_strike]:line-through [&_ul]:list-inside [&_ul]:list-disc ${className ?? ""}`}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized above
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  // @数字.名前 パターン（例: @159.有川智浩）をインラインバッジに変換
  const parts = content.split(/(@\d+\.[^\s\n@,、。！？]+)/g);
  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${className ?? ""}`}>
      {parts.map((part) => {
        const match = part.match(/^@\d+\.(.+)$/);
        if (match?.[1]) {
          return <MentionBadge key={part} displayName={match[1]} />;
        }
        return part;
      })}
    </div>
  );
}
