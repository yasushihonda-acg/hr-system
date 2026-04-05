import type {
  SmartHRConfig,
  SmartHRCrew,
  SmartHRDepartment,
  SmartHRPayStatement,
  SmartHRPosition,
} from "./types.js";

const DEFAULT_BASE_URL = "https://{tenantId}.smarthr.jp/api/v1";
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5分

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * SmartHR REST API クライアント（読み取り専用）
 *
 * - Bearer トークン認証
 * - TTL ベースのインメモリキャッシュ（レート制限対策）
 * - レート制限: 5,000 req/hour, 10 req/sec per token
 */
export class SmartHRClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(config: SmartHRConfig) {
    this.accessToken = config.accessToken;
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL.replace("{tenantId}", config.tenantId);
  }

  /** 従業員一覧取得 */
  async listEmployees(params?: {
    page?: number;
    per_page?: number;
  }): Promise<{ data: SmartHRCrew[]; totalCount: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.per_page) query.set("per_page", String(params.per_page));

    const url = `/crews${query.toString() ? `?${query}` : ""}`;
    return this.fetchList<SmartHRCrew>(url);
  }

  /** 従業員詳細取得 */
  async getEmployee(id: string): Promise<SmartHRCrew> {
    return this.fetchOne<SmartHRCrew>(`/crews/${id}`);
  }

  /** 従業員検索 */
  async searchEmployees(
    query: string,
    params?: { page?: number; per_page?: number },
  ): Promise<{ data: SmartHRCrew[]; totalCount: number }> {
    const searchParams = new URLSearchParams({ q: query });
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.per_page) searchParams.set("per_page", String(params.per_page));

    return this.fetchList<SmartHRCrew>(`/crews?${searchParams}`);
  }

  /** 給与明細取得 */
  async getPayStatements(params?: {
    crew_id?: string;
    year?: number;
    month?: number;
    page?: number;
    per_page?: number;
  }): Promise<{ data: SmartHRPayStatement[]; totalCount: number }> {
    const query = new URLSearchParams();
    if (params?.crew_id) query.set("crew_id", params.crew_id);
    if (params?.year) query.set("year", String(params.year));
    if (params?.month) query.set("month", String(params.month));
    if (params?.page) query.set("page", String(params.page));
    if (params?.per_page) query.set("per_page", String(params.per_page));

    const url = `/pay_statements${query.toString() ? `?${query}` : ""}`;
    return this.fetchList<SmartHRPayStatement>(url);
  }

  /** 部署一覧取得 */
  async listDepartments(params?: {
    page?: number;
    per_page?: number;
  }): Promise<{ data: SmartHRDepartment[]; totalCount: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.per_page) query.set("per_page", String(params.per_page));

    const url = `/departments${query.toString() ? `?${query}` : ""}`;
    return this.fetchList<SmartHRDepartment>(url);
  }

  /** 役職一覧取得 */
  async listPositions(params?: {
    page?: number;
    per_page?: number;
  }): Promise<{ data: SmartHRPosition[]; totalCount: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.per_page) query.set("per_page", String(params.per_page));

    const url = `/positions${query.toString() ? `?${query}` : ""}`;
    return this.fetchList<SmartHRPosition>(url);
  }

  /** キャッシュクリア */
  clearCache(): void {
    this.cache.clear();
  }

  // --- private ---

  private async fetchOne<T>(path: string): Promise<T> {
    const cached = this.getFromCache<T>(path);
    if (cached !== undefined) return cached;

    const response = await this.request(path);
    const data = (await response.json()) as T;
    this.setCache(path, data);
    return data;
  }

  private async fetchList<T>(path: string): Promise<{ data: T[]; totalCount: number }> {
    const cached = this.getFromCache<{ data: T[]; totalCount: number }>(path);
    if (cached !== undefined) return cached;

    const response = await this.request(path);
    const data = (await response.json()) as T[];
    const totalCount = Number(response.headers.get("x-total-count") ?? data.length);
    const result = { data, totalCount };
    this.setCache(path, result);
    return result;
  }

  private async request(path: string): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new SmartHRApiError(
        `SmartHR API error: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    return response;
  }

  private getFromCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}

export class SmartHRApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = "SmartHRApiError";
  }
}
