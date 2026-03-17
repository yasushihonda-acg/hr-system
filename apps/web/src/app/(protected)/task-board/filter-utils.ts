/** フィルター変更時のURL構築（テスト用にexport） */
export function buildFilterUrl(
  searchParams: Record<string, string>,
  paramKey: string,
  value: string,
): string {
  const sp = new URLSearchParams();
  const merged = { ...searchParams, [paramKey]: value, page: "1" };
  for (const [k, v] of Object.entries(merged)) {
    if (v && v !== "all" && !(k === "page" && v === "1")) {
      sp.set(k, v);
    }
  }
  const qs = sp.toString();
  return `/task-board${qs ? `?${qs}` : ""}`;
}
