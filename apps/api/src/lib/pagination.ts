export interface PaginationParams {
  limit: number;
  offset: number;
}

export function parsePagination(query: Record<string, string | undefined>): PaginationParams {
  const rawLimit = Number(query.limit ?? 20);
  const rawOffset = Number(query.offset ?? 0);
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 && rawLimit <= 100 ? rawLimit : 20;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  return { limit, offset };
}
