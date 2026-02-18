import { describe, expect, it } from "vitest";
import { getNextActions, validateTransition } from "../approval.js";

describe("validateTransition", () => {
  describe("正常系", () => {
    it("hr_manager が mechanical draft→reviewed できる", () => {
      const result = validateTransition("draft", "reviewed", "hr_manager", "mechanical");
      expect(result).toEqual({ valid: true });
    });

    it("hr_staff が mechanical draft→reviewed できる", () => {
      const result = validateTransition("draft", "reviewed", "hr_staff", "mechanical");
      expect(result).toEqual({ valid: true });
    });

    it("hr_manager が mechanical reviewed→approved できる", () => {
      const result = validateTransition("reviewed", "approved", "hr_manager", "mechanical");
      expect(result).toEqual({ valid: true });
    });

    it("hr_manager が discretionary reviewed→pending_ceo_approval できる", () => {
      const result = validateTransition(
        "reviewed",
        "pending_ceo_approval",
        "hr_manager",
        "discretionary",
      );
      expect(result).toEqual({ valid: true });
    });

    it("ceo が pending_ceo_approval→approved できる", () => {
      const result = validateTransition("pending_ceo_approval", "approved", "ceo", "discretionary");
      expect(result).toEqual({ valid: true });
    });

    it("ceo が pending_ceo_approval→draft（差し戻し）できる", () => {
      const result = validateTransition("pending_ceo_approval", "draft", "ceo", "discretionary");
      expect(result).toEqual({ valid: true });
    });

    it("hr_staff が reviewed→draft（差し戻し）できる", () => {
      const result = validateTransition("reviewed", "draft", "hr_staff", "mechanical");
      expect(result).toEqual({ valid: true });
    });

    it("hr_staff が rejected→draft できる", () => {
      const result = validateTransition("rejected", "draft", "hr_staff", "mechanical");
      expect(result).toEqual({ valid: true });
    });

    it("hr_staff が draft→rejected できる", () => {
      const result = validateTransition("draft", "rejected", "hr_staff", "mechanical");
      expect(result).toEqual({ valid: true });
    });

    it("system が approved→processing できる", () => {
      const result = validateTransition("approved", "processing", "system", "mechanical");
      expect(result).toEqual({ valid: true });
    });

    it("system が processing→completed できる", () => {
      const result = validateTransition("processing", "completed", "system", "mechanical");
      expect(result).toEqual({ valid: true });
    });

    it("system が processing→failed できる", () => {
      const result = validateTransition("processing", "failed", "system", "mechanical");
      expect(result).toEqual({ valid: true });
    });

    it("hr_staff が failed→processing（リトライ）できる", () => {
      const result = validateTransition("failed", "processing", "hr_staff", "mechanical");
      expect(result).toEqual({ valid: true });
    });

    it("hr_manager が failed→reviewed（手動介入）できる", () => {
      const result = validateTransition("failed", "reviewed", "hr_manager", "mechanical");
      expect(result).toEqual({ valid: true });
    });
  });

  describe("不正な遷移", () => {
    it("存在しない遷移 approved→draft はエラー", () => {
      const result = validateTransition("approved", "draft", "hr_manager", "mechanical");
      expect(result).toEqual({
        valid: false,
        error: "Invalid transition: approved → draft",
      });
    });

    it("存在しない遷移 completed→draft はエラー", () => {
      const result = validateTransition("completed", "draft", "hr_manager", "mechanical");
      expect(result).toEqual({
        valid: false,
        error: "Invalid transition: completed → draft",
      });
    });
  });

  describe("権限不足", () => {
    it("hr_staff が reviewed→approved できない", () => {
      const result = validateTransition("reviewed", "approved", "hr_staff", "mechanical");
      expect(result).toEqual({
        valid: false,
        error: "Role hr_staff is not allowed to transition from reviewed to approved",
      });
    });

    it("ceo が draft→reviewed できない", () => {
      const result = validateTransition("draft", "reviewed", "ceo", "mechanical");
      expect(result).toEqual({
        valid: false,
        error: "Role ceo is not allowed to transition from draft to reviewed",
      });
    });

    it("hr_staff が failed→reviewed できない（hr_managerのみ）", () => {
      const result = validateTransition("failed", "reviewed", "hr_staff", "mechanical");
      expect(result).toEqual({
        valid: false,
        error: "Role hr_staff is not allowed to transition from failed to reviewed",
      });
    });

    it("hr_manager が approved→processing できない（systemのみ）", () => {
      const result = validateTransition("approved", "processing", "hr_manager", "mechanical");
      expect(result).toEqual({
        valid: false,
        error: "Role hr_manager is not allowed to transition from approved to processing",
      });
    });
  });

  describe("changeType 不一致", () => {
    it("hr_manager が discretionary reviewed→approved できない", () => {
      const result = validateTransition("reviewed", "approved", "hr_manager", "discretionary");
      expect(result).toEqual({
        valid: false,
        error: "Transition reviewed → approved requires changeType mechanical",
      });
    });

    it("hr_manager が mechanical reviewed→pending_ceo_approval できない", () => {
      const result = validateTransition(
        "reviewed",
        "pending_ceo_approval",
        "hr_manager",
        "mechanical",
      );
      expect(result).toEqual({
        valid: false,
        error: "Transition reviewed → pending_ceo_approval requires changeType discretionary",
      });
    });
  });
});

describe("getNextActions", () => {
  it("hr_manager + mechanical + reviewed → approved と draft が含まれる", () => {
    const actions = getNextActions("reviewed", "hr_manager", "mechanical");
    expect(actions).toContain("approved");
    expect(actions).toContain("draft");
    expect(actions).not.toContain("pending_ceo_approval");
  });

  it("hr_manager + discretionary + reviewed → pending_ceo_approval と draft が含まれる", () => {
    const actions = getNextActions("reviewed", "hr_manager", "discretionary");
    expect(actions).toContain("pending_ceo_approval");
    expect(actions).toContain("draft");
    expect(actions).not.toContain("approved");
  });

  it("system + mechanical + processing → completed と failed", () => {
    const actions = getNextActions("processing", "system", "mechanical");
    expect(actions).toContain("completed");
    expect(actions).toContain("failed");
  });

  it("hr_staff + mechanical + draft → reviewed と rejected", () => {
    const actions = getNextActions("draft", "hr_staff", "mechanical");
    expect(actions).toContain("reviewed");
    expect(actions).toContain("rejected");
  });

  it("ceo + discretionary + pending_ceo_approval → approved と draft", () => {
    const actions = getNextActions("pending_ceo_approval", "ceo", "discretionary");
    expect(actions).toContain("approved");
    expect(actions).toContain("draft");
  });

  it("hr_staff + mechanical + completed → 空配列", () => {
    const actions = getNextActions("completed", "hr_staff", "mechanical");
    expect(actions).toEqual([]);
  });

  it("hr_staff に reviewed→approved の権限がないので含まれない", () => {
    const actions = getNextActions("reviewed", "hr_staff", "mechanical");
    expect(actions).not.toContain("approved");
    expect(actions).not.toContain("pending_ceo_approval");
    expect(actions).toContain("draft");
  });
});
