import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SmartHRApiError, SmartHRClient } from "../core/smarthr-client.js";

const TEST_CONFIG = {
  accessToken: "test-token",
  tenantId: "test-tenant",
  cacheTtlMs: 1000,
};

function mockFetchResponse(data: unknown, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
    headers: new Headers(headers ?? {}),
  });
}

function mockFetchError(status: number, statusText: string, body: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(body),
    headers: new Headers(),
  });
}

describe("SmartHRClient", () => {
  let client: SmartHRClient;

  beforeEach(() => {
    client = new SmartHRClient(TEST_CONFIG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listEmployees", () => {
    it("従業員一覧を取得できる", async () => {
      const crews = [
        { id: "1", last_name: "田中", first_name: "太郎" },
        { id: "2", last_name: "鈴木", first_name: "花子" },
      ];
      vi.stubGlobal("fetch", mockFetchResponse(crews, { "x-total-count": "2" }));

      const result = await client.listEmployees();

      expect(result.data).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.data[0]?.last_name).toBe("田中");
    });

    it("ページネーションパラメータを送信する", async () => {
      const fetchMock = mockFetchResponse([], { "x-total-count": "0" });
      vi.stubGlobal("fetch", fetchMock);

      await client.listEmployees({ page: 2, per_page: 10 });

      const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("page=2");
      expect(calledUrl).toContain("per_page=10");
    });
  });

  describe("getEmployee", () => {
    it("従業員詳細を取得できる", async () => {
      const crew = { id: "abc", last_name: "田中", first_name: "太郎" };
      vi.stubGlobal("fetch", mockFetchResponse(crew));

      const result = await client.getEmployee("abc");

      expect(result.last_name).toBe("田中");
    });
  });

  describe("searchEmployees", () => {
    it("検索クエリをURLパラメータとして送信する", async () => {
      const fetchMock = mockFetchResponse([], { "x-total-count": "0" });
      vi.stubGlobal("fetch", fetchMock);

      await client.searchEmployees("田中");

      const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("q=%E7%94%B0%E4%B8%AD");
    });
  });

  describe("getPayStatements", () => {
    it("年月で絞り込みできる", async () => {
      const fetchMock = mockFetchResponse([], { "x-total-count": "0" });
      vi.stubGlobal("fetch", fetchMock);

      await client.getPayStatements({ year: 2026, month: 3 });

      const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("year=2026");
      expect(calledUrl).toContain("month=3");
    });
  });

  describe("listDepartments", () => {
    it("部署一覧を取得できる", async () => {
      const departments = [{ id: "d1", name: "人事部" }];
      vi.stubGlobal("fetch", mockFetchResponse(departments, { "x-total-count": "1" }));

      const result = await client.listDepartments();

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("人事部");
    });
  });

  describe("listPositions", () => {
    it("役職一覧を取得できる", async () => {
      const positions = [{ id: "p1", name: "部長" }];
      vi.stubGlobal("fetch", mockFetchResponse(positions, { "x-total-count": "1" }));

      const result = await client.listPositions();

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("部長");
    });
  });

  describe("認証", () => {
    it("Bearerトークンをヘッダーに含める", async () => {
      const fetchMock = mockFetchResponse([]);
      vi.stubGlobal("fetch", fetchMock);

      await client.listEmployees();

      const calledOptions = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(calledOptions.headers).toEqual(
        expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      );
    });
  });

  describe("エラーハンドリング", () => {
    it("APIエラー時にSmartHRApiErrorをスローする", async () => {
      vi.stubGlobal("fetch", mockFetchError(401, "Unauthorized", '{"error":"invalid_token"}'));

      await expect(client.listEmployees()).rejects.toThrow(SmartHRApiError);
      await expect(client.listEmployees()).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe("キャッシュ", () => {
    it("同じリクエストはキャッシュから返す", async () => {
      const fetchMock = mockFetchResponse([{ id: "1" }], { "x-total-count": "1" });
      vi.stubGlobal("fetch", fetchMock);

      await client.listEmployees();
      await client.listEmployees();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("TTL経過後はキャッシュが無効化される", async () => {
      vi.useFakeTimers();
      const fetchMock = mockFetchResponse([{ id: "1" }], { "x-total-count": "1" });
      vi.stubGlobal("fetch", fetchMock);

      await client.listEmployees();

      // TTL超過をシミュレート
      vi.advanceTimersByTime(1100);

      await client.listEmployees();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it("clearCacheでキャッシュをクリアできる", async () => {
      const fetchMock = mockFetchResponse([{ id: "1" }], { "x-total-count": "1" });
      vi.stubGlobal("fetch", fetchMock);

      await client.listEmployees();
      client.clearCache();
      await client.listEmployees();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("ベースURL", () => {
    it("tenantIdからベースURLを構築する", async () => {
      const fetchMock = mockFetchResponse([]);
      vi.stubGlobal("fetch", fetchMock);

      await client.listEmployees();

      const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("test-tenant.smarthr.jp");
    });

    it("カスタムbaseUrlを使用できる", async () => {
      const customClient = new SmartHRClient({
        ...TEST_CONFIG,
        baseUrl: "https://custom.example.com/api/v1",
      });
      const fetchMock = mockFetchResponse([]);
      vi.stubGlobal("fetch", fetchMock);

      await customClient.listEmployees();

      const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("https://custom.example.com/api/v1");
    });
  });
});
