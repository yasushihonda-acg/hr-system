import { describe, expect, it } from "vitest";
import {
  applyMechanicalChange,
  buildBreakdown,
  generateDiscretionaryProposals,
  toChangeItems,
} from "../calculator.js";
import type { AllowanceEntry, MasterData, PitchEntry, SalaryBreakdown } from "../types.js";

/** テスト用マスターデータ */
const PITCH_TABLE: PitchEntry[] = [
  { grade: 1, step: 1, amount: 55000 },
  { grade: 1, step: 2, amount: 60000 },
  { grade: 2, step: 1, amount: 105000 },
  { grade: 2, step: 5, amount: 125000 },
  { grade: 3, step: 1, amount: 155000 },
  { grade: 3, step: 5, amount: 175000 },
  { grade: 3, step: 10, amount: 200000 },
  { grade: 4, step: 1, amount: 205000 },
  { grade: 4, step: 5, amount: 225000 },
  { grade: 5, step: 10, amount: 300000 },
];

const ALLOWANCE_MASTER: AllowanceEntry[] = [
  { allowanceType: "position", code: "MGR_SECT", name: "課長手当", amount: 30000 },
  { allowanceType: "position", code: "LEAD", name: "主任手当", amount: 15000 },
  { allowanceType: "position", code: "STAFF", name: "一般", amount: 0 },
  { allowanceType: "region", code: "URBAN", name: "都市部手当", amount: 20000 },
  { allowanceType: "region", code: "RURAL", name: "地方", amount: 0 },
  { allowanceType: "qualification", code: "CARE_WORKER", name: "介護福祉士手当", amount: 10000 },
  { allowanceType: "qualification", code: "NURSE", name: "看護師手当", amount: 15000 },
  { allowanceType: "qualification", code: "NONE", name: "資格なし", amount: 0 },
];

const MASTER: MasterData = { pitchTable: PITCH_TABLE, allowanceMaster: ALLOWANCE_MASTER };

/** テスト用現行給与 */
const CURRENT: SalaryBreakdown = {
  baseSalary: 155000,
  positionAllowance: 15000,
  regionAllowance: 20000,
  qualificationAllowance: 0,
  otherAllowance: 0,
  total: 190000,
};

describe("buildBreakdown", () => {
  it("total を正しく計算する", () => {
    const result = buildBreakdown(155000, 15000, 20000, 0, 0);
    expect(result.total).toBe(190000);
  });

  it("全ての内訳が保持される", () => {
    const result = buildBreakdown(200000, 30000, 10000, 5000, 3000);
    expect(result.baseSalary).toBe(200000);
    expect(result.positionAllowance).toBe(30000);
    expect(result.regionAllowance).toBe(10000);
    expect(result.qualificationAllowance).toBe(5000);
    expect(result.otherAllowance).toBe(3000);
    expect(result.total).toBe(248000);
  });
});

describe("toChangeItems", () => {
  it("変更がない場合は isChanged = false", () => {
    const items = toChangeItems(CURRENT, CURRENT);
    for (const item of items) {
      expect(item.isChanged).toBe(false);
    }
  });

  it("baseSalary が変わった場合 isChanged = true", () => {
    const after = { ...CURRENT, baseSalary: 175000, total: 210000 };
    const items = toChangeItems(CURRENT, after);
    const baseItem = items.find((i) => i.itemType === "base_salary");
    expect(baseItem?.isChanged).toBe(true);
    expect(baseItem?.beforeAmount).toBe(155000);
    expect(baseItem?.afterAmount).toBe(175000);
  });

  it("全5項目が返る", () => {
    const items = toChangeItems(CURRENT, CURRENT);
    expect(items).toHaveLength(5);
    const types = items.map((i) => i.itemType);
    expect(types).toContain("base_salary");
    expect(types).toContain("position_allowance");
    expect(types).toContain("region_allowance");
    expect(types).toContain("qualification_allowance");
    expect(types).toContain("other_allowance");
  });
});

describe("applyMechanicalChange - pitch_change", () => {
  it("等級3号俸5 → 等級3号俸10 に昇給", () => {
    const result = applyMechanicalChange(
      { kind: "pitch_change", current: CURRENT, newGrade: 3, newStep: 10 },
      MASTER,
    );
    expect(result.changeType).toBe("mechanical");
    expect(result.before.baseSalary).toBe(155000);
    expect(result.after.baseSalary).toBe(200000);
    expect(result.after.positionAllowance).toBe(CURRENT.positionAllowance);
    expect(result.after.total).toBe(200000 + 15000 + 20000);
  });

  it("存在しない grade/step は Error を throw", () => {
    expect(() =>
      applyMechanicalChange(
        { kind: "pitch_change", current: CURRENT, newGrade: 9, newStep: 99 },
        MASTER,
      ),
    ).toThrow(/Pitch entry not found/);
  });

  it("baseSalary 変更項目の isChanged = true", () => {
    const result = applyMechanicalChange(
      { kind: "pitch_change", current: CURRENT, newGrade: 3, newStep: 10 },
      MASTER,
    );
    const base = result.items.find((i) => i.itemType === "base_salary");
    expect(base?.isChanged).toBe(true);
  });
});

describe("applyMechanicalChange - add_allowance", () => {
  it("資格手当（介護福祉士）を追加する", () => {
    const result = applyMechanicalChange(
      {
        kind: "add_allowance",
        current: CURRENT,
        allowanceType: "qualification",
        allowanceCode: "CARE_WORKER",
      },
      MASTER,
    );
    expect(result.changeType).toBe("mechanical");
    expect(result.before.qualificationAllowance).toBe(0);
    expect(result.after.qualificationAllowance).toBe(10000);
    expect(result.after.total).toBe(CURRENT.total + 10000);
  });

  it("役職手当を追加する", () => {
    const result = applyMechanicalChange(
      {
        kind: "add_allowance",
        current: CURRENT,
        allowanceType: "position",
        allowanceCode: "MGR_SECT",
      },
      MASTER,
    );
    expect(result.after.positionAllowance).toBe(30000);
    expect(result.after.total).toBe(CURRENT.total - CURRENT.positionAllowance + 30000);
  });

  it("存在しない allowanceCode は Error を throw", () => {
    expect(() =>
      applyMechanicalChange(
        {
          kind: "add_allowance",
          current: CURRENT,
          allowanceType: "qualification",
          allowanceCode: "NONEXISTENT",
        },
        MASTER,
      ),
    ).toThrow(/Allowance not found/);
  });
});

describe("applyMechanicalChange - remove_allowance", () => {
  it("地域手当を削除する", () => {
    const result = applyMechanicalChange(
      { kind: "remove_allowance", current: CURRENT, allowanceType: "region" },
      MASTER,
    );
    expect(result.before.regionAllowance).toBe(20000);
    expect(result.after.regionAllowance).toBe(0);
    expect(result.after.total).toBe(CURRENT.total - 20000);
  });
});

describe("generateDiscretionaryProposals", () => {
  it("最低2案を返す", () => {
    const proposals = generateDiscretionaryProposals(
      { current: CURRENT, targetTotal: 250000 },
      MASTER,
    );
    expect(proposals.length).toBeGreaterThanOrEqual(2);
  });

  it("各提案の changeType が discretionary", () => {
    const proposals = generateDiscretionaryProposals(
      { current: CURRENT, targetTotal: 250000 },
      MASTER,
    );
    for (const p of proposals) {
      expect(p.result.changeType).toBe("discretionary");
    }
  });

  it("各提案の proposalNumber が 1 から連番", () => {
    const proposals = generateDiscretionaryProposals(
      { current: CURRENT, targetTotal: 250000 },
      MASTER,
    );
    proposals.forEach((p, idx) => {
      expect(p.proposalNumber).toBe(idx + 1);
    });
  });

  it("各提案に description がある", () => {
    const proposals = generateDiscretionaryProposals(
      { current: CURRENT, targetTotal: 250000 },
      MASTER,
    );
    for (const p of proposals) {
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("before の total が current.total と一致する", () => {
    const proposals = generateDiscretionaryProposals(
      { current: CURRENT, targetTotal: 250000 },
      MASTER,
    );
    for (const p of proposals) {
      expect(p.result.before.total).toBe(CURRENT.total);
    }
  });

  it("after の total がそれぞれ target に近い（±20%以内）", () => {
    const target = 250000;
    const proposals = generateDiscretionaryProposals(
      { current: CURRENT, targetTotal: target },
      MASTER,
    );
    for (const p of proposals) {
      expect(Math.abs(p.result.after.total - target) / target).toBeLessThan(0.2);
    }
  });

  it("Pitchテーブルが空のとき空配列を返す", () => {
    const emptyMaster: MasterData = { pitchTable: [], allowanceMaster: ALLOWANCE_MASTER };
    const proposals = generateDiscretionaryProposals(
      { current: CURRENT, targetTotal: 250000 },
      emptyMaster,
    );
    expect(proposals).toEqual([]);
  });

  it("提案の baseSalary がいずれも Pitch テーブルの有効な値である", () => {
    const proposals = generateDiscretionaryProposals(
      { current: CURRENT, targetTotal: 250000 },
      MASTER,
    );
    const validAmounts = new Set(PITCH_TABLE.map((p) => p.amount));
    for (const p of proposals) {
      expect(validAmounts.has(p.result.after.baseSalary)).toBe(true);
    }
  });
});
