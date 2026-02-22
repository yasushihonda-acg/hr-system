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

export interface MentionedUser {
  userId: string;
  displayName: string;
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

/**
 * プレーンテキスト内の <users/ID> をdisplayNameに変換するユーティリティ。
 * テストやstripHtml後のプレーンテキスト生成に利用する。
 */
export function resolveUserMentions(content: string, mentionedUsers: MentionedUser[]): string {
  return content.replace(/<users\/([^>]+)>/g, (_, rawId) => {
    const userId = `users/${rawId}`;
    const user = mentionedUsers.find((u) => u.userId === userId);
    return user?.displayName ?? rawId;
  });
}

/**
 * HTML 文字列内の <users/ID> を @displayName に変換する。
 * sanitizeHtml は未知タグを除去するため、サニタイズ前に呼び出す必要がある。
 */
export function resolveHtmlMentions(html: string, mentionedUsers: MentionedUser[]): string {
  return html.replace(/<users\/([^>]+)>/g, (_, rawId) => {
    const userId = `users/${rawId}`;
    const user = mentionedUsers.find((u) => u.userId === userId);
    return `@${user?.displayName ?? rawId}`;
  });
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
 * プレーンテキスト内の <users/ID> パターン（Google Chat API形式）を MentionBadge に変換する。
 * formattedContent がある場合は RichContent と同じHTML表示にフォールバックする。
 */
export function ContentWithMentions({
  content,
  formattedContent,
  mentionedUsers = [],
  className,
}: RichContentProps & { mentionedUsers?: MentionedUser[]; className?: string }) {
  if (formattedContent) {
    // <users/ID> を @displayName に変換してからサニタイズする。
    // sanitizeHtml は未知タグを除去するため、先に解決しないとメンションが消える。
    const safeHtml = sanitizeHtml(resolveHtmlMentions(formattedContent, mentionedUsers));
    return (
      <div
        className={`leading-relaxed [&_a]:text-primary [&_a]:underline [&_b]:font-bold [&_i]:italic [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs [&_s]:line-through [&_strike]:line-through [&_ul]:list-inside [&_ul]:list-disc ${className ?? ""}`}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized above
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  // <users/ID> パターン（Google Chat API形式）をインラインバッジに変換
  const parts = content.split(/(<users\/[^>]+>)/g);
  let charOffset = 0;
  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${className ?? ""}`}>
      {parts.map((part) => {
        const key = `p${charOffset}`;
        charOffset += part.length;
        const match = part.match(/^<users\/([^>]+)>$/);
        if (match?.[1] !== undefined) {
          const userId = `users/${match[1]}`;
          const user = mentionedUsers.find((u) => u.userId === userId);
          return <MentionBadge key={key} displayName={user?.displayName ?? match[1]} />;
        }
        return part;
      })}
    </div>
  );
}
