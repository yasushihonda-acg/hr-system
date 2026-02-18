import type { SalaryItemType } from "@hr-system/shared";
import type {
  DiscretionaryChangeParams,
  MasterData,
  MechanicalChangeParams,
  SalaryBreakdown,
  SalaryCalculationResult,
  SalaryChangeItem,
  SalaryProposal,
} from "./types.js";

/** 給与内訳を組み立て、total を計算して返す */
export function buildBreakdown(
  baseSalary: number,
  positionAllowance: number,
  regionAllowance: number,
  qualificationAllowance: number,
  otherAllowance: number,
): SalaryBreakdown {
  return {
    baseSalary,
    positionAllowance,
    regionAllowance,
    qualificationAllowance,
    otherAllowance,
    total:
      baseSalary + positionAllowance + regionAllowance + qualificationAllowance + otherAllowance,
  };
}

/** Before/After から変更項目リストを生成する */
export function toChangeItems(before: SalaryBreakdown, after: SalaryBreakdown): SalaryChangeItem[] {
  const fields: Array<{ itemType: SalaryItemType; itemName: string; key: keyof SalaryBreakdown }> =
    [
      { itemType: "base_salary", itemName: "基本給", key: "baseSalary" },
      { itemType: "position_allowance", itemName: "役職手当", key: "positionAllowance" },
      { itemType: "region_allowance", itemName: "地域手当", key: "regionAllowance" },
      {
        itemType: "qualification_allowance",
        itemName: "資格手当",
        key: "qualificationAllowance",
      },
      { itemType: "other_allowance", itemName: "その他手当", key: "otherAllowance" },
    ];

  return fields.map(({ itemType, itemName, key }) => ({
    itemType,
    itemName,
    beforeAmount: before[key] as number,
    afterAmount: after[key] as number,
    isChanged: before[key] !== after[key],
  }));
}

/**
 * 機械的変更を適用して計算結果を返す（ADR-007: 確定的コードで計算）
 *
 * @throws {Error} Pitch エントリが見つからない場合
 * @throws {Error} 手当コードが見つからない場合
 */
export function applyMechanicalChange(
  params: MechanicalChangeParams,
  master: MasterData,
): SalaryCalculationResult {
  const before = params.current;
  let after: SalaryBreakdown;

  switch (params.kind) {
    case "pitch_change": {
      const entry = master.pitchTable.find(
        (p) => p.grade === params.newGrade && p.step === params.newStep,
      );
      if (!entry) {
        throw new Error(`Pitch entry not found: grade=${params.newGrade}, step=${params.newStep}`);
      }
      after = buildBreakdown(
        entry.amount,
        before.positionAllowance,
        before.regionAllowance,
        before.qualificationAllowance,
        before.otherAllowance,
      );
      break;
    }

    case "add_allowance": {
      const entry = master.allowanceMaster.find(
        (a) => a.allowanceType === params.allowanceType && a.code === params.allowanceCode,
      );
      if (!entry) {
        throw new Error(
          `Allowance not found: type=${params.allowanceType}, code=${params.allowanceCode}`,
        );
      }
      after = buildBreakdown(
        before.baseSalary,
        params.allowanceType === "position" ? entry.amount : before.positionAllowance,
        params.allowanceType === "region" ? entry.amount : before.regionAllowance,
        params.allowanceType === "qualification" ? entry.amount : before.qualificationAllowance,
        before.otherAllowance,
      );
      break;
    }

    case "remove_allowance": {
      after = buildBreakdown(
        before.baseSalary,
        params.allowanceType === "position" ? 0 : before.positionAllowance,
        params.allowanceType === "region" ? 0 : before.regionAllowance,
        params.allowanceType === "qualification" ? 0 : before.qualificationAllowance,
        before.otherAllowance,
      );
      break;
    }
  }

  return {
    changeType: "mechanical",
    before,
    after,
    items: toChangeItems(before, after),
  };
}

/**
 * 裁量的変更の複数提案を生成する（ADR-007: 確定的コードで計算）
 *
 * 目標合計額に近い Pitch エントリをベースに最大3案を提案する。
 * 各提案は baseSalary のみを変更し、他の手当は現行のまま維持する。
 */
export function generateDiscretionaryProposals(
  params: DiscretionaryChangeParams,
  master: MasterData,
): SalaryProposal[] {
  const { current, targetTotal } = params;
  const { pitchTable } = master;

  if (pitchTable.length === 0) {
    return [];
  }

  // 目標 baseSalary = targetTotal - 現行の手当合計
  const currentAllowances =
    current.positionAllowance +
    current.regionAllowance +
    current.qualificationAllowance +
    current.otherAllowance;
  const targetBase = targetTotal - currentAllowances;

  // Pitch エントリを目標 baseSalary との差の絶対値でソート
  const sorted = [...pitchTable].sort(
    (a, b) => Math.abs(a.amount - targetBase) - Math.abs(b.amount - targetBase),
  );

  // 重複した amount を除去して上位3件を選ぶ
  const seen = new Set<number>();
  const candidates = sorted.filter((entry) => {
    if (seen.has(entry.amount)) return false;
    seen.add(entry.amount);
    return true;
  });

  return candidates.slice(0, 3).map((entry, idx) => {
    const after = buildBreakdown(
      entry.amount,
      current.positionAllowance,
      current.regionAllowance,
      current.qualificationAllowance,
      current.otherAllowance,
    );
    const diff = after.total - current.total;
    const sign = diff >= 0 ? "+" : "";
    const description =
      `提案${idx + 1}: 基本給 ${entry.amount.toLocaleString()}円 ` +
      `(等級${entry.grade}/号俸${entry.step}) → ` +
      `合計 ${after.total.toLocaleString()}円 (${sign}${diff.toLocaleString()}円)`;

    return {
      proposalNumber: idx + 1,
      description,
      result: {
        changeType: "discretionary" as const,
        before: current,
        after,
        items: toChangeItems(current, after),
      },
    };
  });
}
