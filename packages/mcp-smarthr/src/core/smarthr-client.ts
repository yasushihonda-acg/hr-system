import { RateLimiter } from "./lib/rate-limiter.js";
import type { SmartHRConfig, SmartHRCrew, SmartHRDepartment, SmartHRPosition } from "./types.js";

const DEFAULT_BASE_URL = "https://{tenantId}.smarthr.jp/api/v1";
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5分
const MAX_RETRIES = 3;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * SmartHR REST API クライアント
 *
 * - Bearer トークン認証
 * - TTL ベースのインメモリキャッシュ（レート制限対策、読み取りのみ）
 * - レート制限: 5,000 req/hour, 10 req/sec per token
 * - 書き込み操作（PATCH/POST）はキャッシュ無効化付き
 */
export class SmartHRClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly rateLimiter: RateLimiter;

  constructor(config: SmartHRConfig) {
    this.accessToken = config.accessToken;
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL.replace("{tenantId}", config.tenantId);
    this.rateLimiter = new RateLimiter();
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

  /** 従業員情報を部分更新（PATCH） */
  async updateEmployee(id: string, fields: Record<string, unknown>): Promise<SmartHRCrew> {
    const response = await this.request(`/crews/${id}`, {
      method: "PATCH",
      body: fields,
    });
    const data = (await response.json()) as SmartHRCrew;
    try {
      this.invalidateCrewCache(id);
    } catch {
      // キャッシュ無効化失敗は書き込み成功をブロックしない
    }
    return data;
  }

  /** 従業員を新規登録（POST） */
  async createEmployee(fields: Record<string, unknown>): Promise<SmartHRCrew> {
    const response = await this.request("/crews", {
      method: "POST",
      body: fields,
    });
    const data = (await response.json()) as SmartHRCrew;
    try {
      this.invalidateCrewCache();
    } catch {
      // キャッシュ無効化失敗は書き込み成功をブロックしない
    }
    return data;
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

  private async request(
    path: string,
    options?: { method?: string; body?: Record<string, unknown> },
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const method = options?.method ?? "GET";
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    };
    if (options?.body) {
      headers["Content-Type"] = "application/json";
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.rateLimiter.waitForSlot();

      const response = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      this.rateLimiter.onResponse(response.headers);

      if (response.status === 429 && attempt < MAX_RETRIES) {
        // POST は非冪等のためリトライしない（従業員重複作成リスク回避）
        if (method !== "GET" && method !== "PATCH") {
          const body = await response.text().catch(() => "");
          throw new SmartHRApiError(
            `SmartHR API rate limited on ${method} request (not retrying non-idempotent)`,
            429,
            body,
          );
        }
        const delay = this.rateLimiter.getRetryDelay(response.headers, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

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

    // TypeScript: ループ後の到達不能コードだが型安全のために必要
    throw new SmartHRApiError("SmartHR API error: 429 Too Many Requests", 429, "");
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

  /** 書き込み後に従業員関連キャッシュを無効化する */
  private invalidateCrewCache(id?: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith("/crews")) {
        // 特定IDの場合はそのIDと一覧系のみ無効化、IDなしは全crews無効化
        if (!id || key === `/crews/${id}` || key.includes("?") || key === "/crews") {
          this.cache.delete(key);
        }
      }
    }
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
