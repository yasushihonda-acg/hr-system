function SkeletonMessage() {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-slate-200" />
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mt-1 h-4 w-full animate-pulse rounded bg-slate-200" />
      <div className="mt-1.5 flex gap-1.5">
        <div className="h-5 w-12 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-8 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}

export default function InboxLoading() {
  return (
    <div className="-m-6 flex h-[calc(100vh-52px)] flex-col">
      {/* ヘッダー スケルトン */}
      <div className="flex-shrink-0 border-b border-border/60 bg-white px-5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="h-6 w-16 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="mb-2 flex gap-1">
          <div className="h-7 w-24 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-200" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-7 w-16 animate-pulse rounded-full bg-slate-200" />
          <div className="h-7 w-16 animate-pulse rounded-full bg-slate-200" />
          <div className="h-7 w-16 animate-pulse rounded-full bg-slate-200" />
          <div className="h-7 w-16 animate-pulse rounded-full bg-slate-200" />
          <div className="h-7 w-16 animate-pulse rounded-full bg-slate-200" />
        </div>
      </div>

      {/* メッセージリスト スケルトン */}
      <div className="flex-1 overflow-hidden">
        <div className="w-full divide-y divide-border/40 md:w-[320px]">
          <SkeletonMessage />
          <SkeletonMessage />
          <SkeletonMessage />
          <SkeletonMessage />
          <SkeletonMessage />
          <SkeletonMessage />
          <SkeletonMessage />
          <SkeletonMessage />
          <SkeletonMessage />
          <SkeletonMessage />
        </div>
      </div>

      {/* ページネーション スケルトン */}
      <div className="flex-shrink-0 border-t border-border/60 bg-white px-5 py-2">
        <div className="flex items-center justify-center gap-2">
          <div className="h-8 w-14 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-8 w-14 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
