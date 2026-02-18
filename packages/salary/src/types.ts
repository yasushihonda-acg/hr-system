import type { AllowanceType, ChangeType, SalaryItemType } from "@hr-system/shared";

/** 給与内訳（計算入出力用） */
export interface SalaryBreakdown {
  baseSalary: number;
  positionAllowance: number;
  regionAllowance: number;
  qualificationAllowance: number;
  otherAllowance: number;
  total: number;
}

/** 変更項目（Before/After 差分） */
export interface SalaryChangeItem {
  itemType: SalaryItemType;
  itemName: string;
  beforeAmount: number;
  afterAmount: number;
  isChanged: boolean;
}

/** Pitchテーブルエントリ（計算用・DB 非依存） */
export interface PitchEntry {
  grade: number;
  step: number;
  amount: number;
}

/** 手当マスターエントリ（計算用・DB 非依存） */
export interface AllowanceEntry {
  allowanceType: AllowanceType;
  code: string;
  name: string;
  amount: number;
}

/** 計算に必要なマスターデータ（DB から注入） */
export interface MasterData {
  pitchTable: PitchEntry[];
  allowanceMaster: AllowanceEntry[];
}

/** 機械的変更パラメータ（LLM が抽出した値を受け取る） */
export type MechanicalChangeParams =
  | {
      kind: "pitch_change";
      current: SalaryBreakdown;
      newGrade: number;
      newStep: number;
    }
  | {
      kind: "add_allowance";
      current: SalaryBreakdown;
      allowanceType: AllowanceType;
      allowanceCode: string;
    }
  | {
      kind: "remove_allowance";
      current: SalaryBreakdown;
      allowanceType: AllowanceType;
    };

/** 裁量的変更パラメータ */
export interface DiscretionaryChangeParams {
  current: SalaryBreakdown;
  /** 目標合計支給額 */
  targetTotal: number;
}

/** 給与計算結果（単一案） */
export interface SalaryCalculationResult {
  changeType: ChangeType;
  before: SalaryBreakdown;
  after: SalaryBreakdown;
  items: SalaryChangeItem[];
}

/** 裁量的変更の提案（複数案の1つ） */
export interface SalaryProposal {
  proposalNumber: number;
  /** 人事担当者向けの提案説明 */
  description: string;
  result: SalaryCalculationResult;
}
