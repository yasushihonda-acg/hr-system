import { describe, expect, it } from "vitest";
import { filterPII, maskPII } from "../core/middleware/pii-filter.js";

describe("filterPII", () => {
  const crewData = {
    id: "emp-001",
    last_name: "田中",
    first_name: "太郎",
    email: "tanaka@example.com",
    gender: "male",
    birth_at: "1990-01-15",
    bank_accounts: [{ bank_name: "みずほ銀行", account: "1234567" }],
    my_number: "123456789012",
    tel_number: "090-1234-5678",
    address: "東京都千代田区1-1-1",
    resident_card_address: "東京都千代田区1-1-1",
    emergency_address: "大阪府大阪市北区2-2-2",
    department: { id: "dept-1", name: "開発部", code: "D001" },
    position: "エンジニア",
  };

  describe("readonly ロール", () => {
    it("birth_at, email, gender, bank_accounts が除去されること", () => {
      const result = filterPII(crewData, "readonly");

      expect(result).not.toHaveProperty("birth_at");
      expect(result).not.toHaveProperty("email");
      expect(result).not.toHaveProperty("gender");
      expect(result).not.toHaveProperty("bank_accounts");
    });

    it("my_number, tel_number, address, resident_card_address, emergency_address が除去されること", () => {
      const result = filterPII(crewData, "readonly");

      expect(result).not.toHaveProperty("my_number");
      expect(result).not.toHaveProperty("tel_number");
      expect(result).not.toHaveProperty("address");
      expect(result).not.toHaveProperty("resident_card_address");
      expect(result).not.toHaveProperty("emergency_address");
    });

    it("非 PII フィールドは保持されること", () => {
      const result = filterPII(crewData, "readonly");

      expect(result).toHaveProperty("id", "emp-001");
      expect(result).toHaveProperty("last_name", "田中");
      expect(result).toHaveProperty("first_name", "太郎");
      expect(result).toHaveProperty("position", "エンジニア");
    });
  });

  describe("admin ロール", () => {
    it("my_number のみ除去されること", () => {
      const result = filterPII(crewData, "admin");

      expect(result).not.toHaveProperty("my_number");
    });

    it("他の PII フィールドは保持されること", () => {
      const result = filterPII(crewData, "admin");

      expect(result).toHaveProperty("email", "tanaka@example.com");
      expect(result).toHaveProperty("gender", "male");
      expect(result).toHaveProperty("birth_at", "1990-01-15");
      expect(result).toHaveProperty("bank_accounts");
      expect(result).toHaveProperty("tel_number");
      expect(result).toHaveProperty("address");
    });
  });

  describe("ネストされたオブジェクト", () => {
    it("ネスト内の PII フィールドも除去されること", () => {
      const nested = {
        id: "record-1",
        employee: {
          id: "emp-001",
          email: "test@example.com",
          my_number: "999999999999",
          profile: {
            birth_at: "2000-01-01",
            name: "山田花子",
          },
        },
      };

      const result = filterPII(nested, "readonly");

      expect(result).toHaveProperty("id", "record-1");
      expect(result).toHaveProperty("employee.id", "emp-001");
      expect(result).not.toHaveProperty("employee.email");
      expect(result).not.toHaveProperty("employee.my_number");
      expect(result).not.toHaveProperty("employee.profile.birth_at");
      expect(result).toHaveProperty("employee.profile.name", "山田花子");
    });
  });

  describe("配列", () => {
    it("配列内のオブジェクトにもフィルタが適用されること", () => {
      const list = [
        { id: "1", email: "a@example.com", name: "A" },
        { id: "2", email: "b@example.com", name: "B" },
      ];

      const result = filterPII(list, "readonly");

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty("email");
      expect(result[0]).toHaveProperty("name", "A");
      expect(result[1]).not.toHaveProperty("email");
      expect(result[1]).toHaveProperty("name", "B");
    });
  });

  describe("エッジケース", () => {
    it("null 入力でクラッシュしないこと", () => {
      expect(filterPII(null, "readonly")).toBeNull();
    });

    it("undefined 入力でクラッシュしないこと", () => {
      expect(filterPII(undefined, "readonly")).toBeUndefined();
    });

    it("プリミティブ型はそのまま返すこと", () => {
      expect(filterPII(42, "readonly")).toBe(42);
      expect(filterPII("hello", "admin")).toBe("hello");
      expect(filterPII(true, "readonly")).toBe(true);
    });
  });
});

describe("maskPII", () => {
  it("PII フィールドが [REDACTED] に置換されること", () => {
    const data = {
      id: "emp-001",
      email: "tanaka@example.com",
      my_number: "123456789012",
      birth_at: "1990-01-15",
      gender: "male",
      tel_number: "090-1234-5678",
      address: "東京都千代田区",
      last_name: "田中",
    };

    const result = maskPII(data) as Record<string, unknown>;

    expect(result.email).toBe("[REDACTED]");
    expect(result.my_number).toBe("[REDACTED]");
    expect(result.birth_at).toBe("[REDACTED]");
    expect(result.gender).toBe("[REDACTED]");
    expect(result.tel_number).toBe("[REDACTED]");
    expect(result.address).toBe("[REDACTED]");
    expect(result.last_name).toBe("田中");
    expect(result.id).toBe("emp-001");
  });

  it("ネストされたオブジェクトの PII もマスクされること", () => {
    const data = {
      records: {
        employee: {
          email: "test@example.com",
          name: "テスト",
        },
      },
    };

    const result = maskPII(data) as Record<string, unknown>;
    const employee = (result.records as Record<string, unknown>).employee as Record<
      string,
      unknown
    >;

    expect(employee.email).toBe("[REDACTED]");
    expect(employee.name).toBe("テスト");
  });

  it("配列内のオブジェクトの PII もマスクされること", () => {
    const data = [
      { id: "1", email: "a@test.com" },
      { id: "2", email: "b@test.com" },
    ];

    const result = maskPII(data) as Array<Record<string, unknown>>;

    expect(result[0]?.email).toBe("[REDACTED]");
    expect(result[1]?.email).toBe("[REDACTED]");
    expect(result[0]?.id).toBe("1");
  });

  it("null 入力でクラッシュしないこと", () => {
    expect(maskPII(null)).toBeNull();
  });

  it("undefined 入力でクラッシュしないこと", () => {
    expect(maskPII(undefined)).toBeUndefined();
  });
});
