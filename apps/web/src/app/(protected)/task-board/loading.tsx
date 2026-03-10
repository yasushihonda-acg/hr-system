function SkeletonRow() {
  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-slate-200" />
        <div className="h-3 w-3 rounded-full bg-slate-200" />
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div className="ml-auto h-4 w-12 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mt-1 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

export default function TaskBoardLoading() {
  return (
    <div className="-m-6 flex h-[calc(100vh-52px)] flex-col">
      {/* フィルターヘッダー スケルトン */}
      <div className="flex-shrink-0 border-b border-border/60 bg-white px-5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="mb-2 flex gap-1.5">
          <div className="h-7 w-12 animate-pulse rounded-full bg-slate-200" />
          <div className="h-7 w-12 animate-pulse rounded-full bg-slate-200" />
          <div className="h-7 w-12 animate-pulse rounded-full bg-slate-200" />
          <div className="h-7 w-12 animate-pulse rounded-full bg-slate-200" />
          <div className="h-7 w-12 animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-7 w-4 bg-transparent" />
          <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* タスクリスト スケルトン */}
      <div className="flex-1 divide-y divide-border/40 overflow-hidden">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}
