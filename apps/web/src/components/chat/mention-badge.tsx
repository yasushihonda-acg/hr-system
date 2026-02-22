/**
 * メンションバッジコンポーネント
 * @name をインラインバッジ（インディゴ系）で表示する。
 */

interface MentionBadgeProps {
  displayName: string;
}

export function MentionBadge({ displayName }: MentionBadgeProps) {
  const name = displayName || "不明ユーザー";
  const initial = name.slice(0, 1);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold text-indigo-700">
        {initial}
      </span>
      @{name}
    </span>
  );
}
