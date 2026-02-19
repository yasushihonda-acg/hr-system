import { extractSalaryParams, type IntentClassificationResult } from "@hr-system/ai";
import type { AllowanceMaster, Employee, PitchTable, Salary } from "@hr-system/db";
import { collections, db } from "@hr-system/db";
import type { MasterData, SalaryBreakdown } from "@hr-system/salary";
import {
  applyMechanicalChange,
  buildBreakdown,
  generateDiscretionaryProposals,
  toChangeItems,
} from "@hr-system/salary";
import type { AllowanceType } from "@hr-system/shared";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { WorkerError } from "../lib/errors.js";
import type { ChatEvent } from "../lib/event-parser.js";

/**
 * 給与カテゴリのメッセージを処理する。
 * extractSalaryParams() → Employee 検索 → 給与計算 → SalaryDraft + Items 保存
 */
export async function handleSalary(
  chatMessageId: string,
  event: ChatEvent,
  intentResult: IntentClassificationResult,
): Promise<void> {
  // 1. 給与パラメータ抽出（LLM）
  let params: Awaited<ReturnType<typeof extractSalaryParams>>;
  try {
    params = await extractSalaryParams(event.text);
  } catch (e) {
    throw new WorkerError("LLM_ERROR", `給与パラメータ抽出失敗: ${String(e)}`, true);
  }

  // 2. 従業員検索
  const employee = await findEmployee(params.employeeIdentifier);

  // 3. 現行給与取得
  const currentSalary = await getCurrentSalary(employee.id);

  // 4. マスターデータ取得
  const masterData = await getMasterData();

  // 5. 現行給与内訳を構築
  const currentBreakdown = buildBreakdown(
    currentSalary.baseSalary,
    currentSalary.positionAllowance,
    currentSalary.regionAllowance,
    currentSalary.qualificationAllowance,
    currentSalary.otherAllowance,
  );

  // 6. 給与計算（確定的コード — LLM に計算させない）
  if (params.changeType === "discretionary") {
    await handleDiscretionary(
      chatMessageId,
      employee.id,
      currentBreakdown,
      params.targetSalary,
      params.reasoning,
      intentResult.confidence,
      masterData,
    );
  } else {
    // mechanical
    await handleMechanical(
      chatMessageId,
      employee.id,
      currentBreakdown,
      params,
      intentResult.confidence,
      masterData,
    );
  }
}

/** 裁量的変更: 複数提案を生成し先頭案を draft として保存 */
async function handleDiscretionary(
  chatMessageId: string,
  employeeId: string,
  current: SalaryBreakdown,
  targetSalary: number | null,
  reasoning: string,
  aiConfidence: number,
  masterData: MasterData,
): Promise<void> {
  if (targetSalary === null) {
    throw new WorkerError("SALARY_CALC_ERROR", "裁量的変更には targetSalary が必要です", false, {
      employeeId,
    });
  }

  const proposals = generateDiscretionaryProposals(
    { current, targetTotal: targetSalary },
    masterData,
  );

  if (proposals.length === 0) {
    throw new WorkerError("SALARY_CALC_ERROR", "裁量的変更の提案を生成できませんでした", false, {
      employeeId,
      targetSalary,
    });
  }

  // Phase 1: 提案案ごとに SalaryDraft を作成（バッチ書き込み）
  const batch = db.batch();
  const now = FieldValue.serverTimestamp() as never;
  // effectiveDate: 翌月1日
  const effectiveDate = getNextMonthFirst();

  for (const proposal of proposals) {
    const { result } = proposal;
    const draftRef = collections.salaryDrafts.doc();
    batch.set(draftRef, {
      employeeId,
      chatMessageId,
      status: "draft" as const,
      changeType: "discretionary" as const,
      reason: `${proposal.description} (提案${proposal.proposalNumber})`,
      beforeBaseSalary: result.before.baseSalary,
      afterBaseSalary: result.after.baseSalary,
      beforeTotal: result.before.total,
      afterTotal: result.after.total,
      effectiveDate: Timestamp.fromDate(effectiveDate),
      aiConfidence,
      aiReasoning: reasoning,
      appliedRules: null,
      reviewedBy: null,
      reviewedAt: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const items = toChangeItems(result.before, result.after);
    for (const item of items) {
      const itemRef = collections.salaryDraftItems.doc();
      batch.set(itemRef, {
        draftId: draftRef.id,
        itemType: item.itemType,
        itemName: item.itemName,
        beforeAmount: item.beforeAmount,
        afterAmount: item.afterAmount,
        isChanged: item.isChanged,
      });
    }

    // 監査ログ
    const auditRef = collections.auditLogs.doc();
    batch.set(auditRef, {
      eventType: "draft_created" as const,
      entityType: "salary_draft",
      entityId: draftRef.id,
      actorEmail: null,
      actorRole: null,
      details: { chatMessageId, proposalNumber: proposal.proposalNumber },
      createdAt: now,
    });
  }

  try {
    await batch.commit();
  } catch (e) {
    throw new WorkerError("DB_ERROR", `SalaryDraft バッチ書き込み失敗: ${String(e)}`, true);
  }

  console.info(`[Worker] 裁量的変更 ${proposals.length} 案のドラフトを作成しました`);
}

/** 機械的変更: pitch_change または allowance 変更 */
async function handleMechanical(
  chatMessageId: string,
  employeeId: string,
  current: SalaryBreakdown,
  params: {
    targetSalary: number | null;
    allowanceType: string | null;
    reasoning: string;
  },
  aiConfidence: number,
  masterData: MasterData,
): Promise<void> {
  let result: ReturnType<typeof applyMechanicalChange>;

  try {
    if (params.allowanceType) {
      // 手当の追加（remove は Phase 2）
      const allowanceType = params.allowanceType as AllowanceType;
      const allowanceEntry = masterData.allowanceMaster.find(
        (a) => a.allowanceType === allowanceType,
      );
      if (!allowanceEntry) {
        throw new WorkerError(
          "SALARY_CALC_ERROR",
          `手当マスタに "${allowanceType}" が見つかりません`,
          false,
          { employeeId, allowanceType },
        );
      }
      result = applyMechanicalChange(
        { kind: "add_allowance", current, allowanceType, allowanceCode: allowanceEntry.code },
        masterData,
      );
    } else if (params.targetSalary !== null) {
      // Pitch 変更: targetSalary に最も近い Pitch エントリを検索
      const pitchEntry = findNearestPitch(params.targetSalary, masterData.pitchTable);
      if (!pitchEntry) {
        throw new WorkerError(
          "SALARY_CALC_ERROR",
          "Pitch テーブルに対応するエントリが見つかりません",
          false,
        );
      }
      result = applyMechanicalChange(
        { kind: "pitch_change", current, newGrade: pitchEntry.grade, newStep: pitchEntry.step },
        masterData,
      );
    } else {
      throw new WorkerError(
        "SALARY_CALC_ERROR",
        "機械的変更には targetSalary または allowanceType が必要です",
        false,
        { employeeId },
      );
    }
  } catch (e) {
    if (e instanceof WorkerError) throw e;
    // applyMechanicalChange が throw した場合（エントリ未発見等）
    throw new WorkerError("SALARY_CALC_ERROR", "給与計算失敗", false);
  }

  // バッチ書き込み
  const batch = db.batch();
  const now = FieldValue.serverTimestamp() as never;
  const effectiveDate = getNextMonthFirst();
  const draftRef = collections.salaryDrafts.doc();

  batch.set(draftRef, {
    employeeId,
    chatMessageId,
    status: "draft" as const,
    changeType: "mechanical" as const,
    reason: params.reasoning,
    beforeBaseSalary: result.before.baseSalary,
    afterBaseSalary: result.after.baseSalary,
    beforeTotal: result.before.total,
    afterTotal: result.after.total,
    effectiveDate: Timestamp.fromDate(effectiveDate),
    aiConfidence,
    aiReasoning: params.reasoning,
    appliedRules: null,
    reviewedBy: null,
    reviewedAt: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const items = toChangeItems(result.before, result.after);
  for (const item of items) {
    const itemRef = collections.salaryDraftItems.doc();
    batch.set(itemRef, {
      draftId: draftRef.id,
      itemType: item.itemType,
      itemName: item.itemName,
      beforeAmount: item.beforeAmount,
      afterAmount: item.afterAmount,
      isChanged: item.isChanged,
    });
  }

  const auditRef = collections.auditLogs.doc();
  batch.set(auditRef, {
    eventType: "draft_created" as const,
    entityType: "salary_draft",
    entityId: draftRef.id,
    actorEmail: null,
    actorRole: null,
    details: { chatMessageId },
    createdAt: now,
  });

  try {
    await batch.commit();
  } catch (e) {
    throw new WorkerError("DB_ERROR", `SalaryDraft バッチ書き込み失敗: ${String(e)}`, true);
  }

  console.info(`[Worker] 機械的変更ドラフトを作成しました: ${draftRef.id}`);
}

// ---------------------------------------------------------------------------
// Firestore ヘルパー
// ---------------------------------------------------------------------------

/** 従業員を employeeNumber または name で検索する */
async function findEmployee(identifier: string | null): Promise<{ id: string } & Employee> {
  if (!identifier) {
    throw new WorkerError("EMPLOYEE_NOT_FOUND", "従業員識別子が指定されていません", false);
  }

  // 1. employeeNumber で検索
  const byNumber = await collections.employees
    .where("employeeNumber", "==", identifier)
    .where("isActive", "==", true)
    .limit(1)
    .get();

  if (!byNumber.empty) {
    const doc = byNumber.docs.at(0);
    if (doc) return { id: doc.id, ...doc.data() };
  }

  // 2. name で検索
  const byName = await collections.employees
    .where("name", "==", identifier)
    .where("isActive", "==", true)
    .limit(1)
    .get();

  if (!byName.empty) {
    const doc = byName.docs.at(0);
    if (doc) return { id: doc.id, ...doc.data() };
  }

  throw new WorkerError("EMPLOYEE_NOT_FOUND", "従業員が見つかりません", false);
}

/** 最新の有効な給与を取得する */
async function getCurrentSalary(employeeId: string): Promise<{ id: string } & Salary> {
  const snap = await collections.salaries
    .where("employeeId", "==", employeeId)
    .where("effectiveTo", "==", null)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new WorkerError("SALARY_CALC_ERROR", "現行給与が見つかりません", false);
  }

  const doc = snap.docs.at(0);
  if (!doc) {
    throw new WorkerError("SALARY_CALC_ERROR", "現行給与が見つかりません", false);
  }
  return { id: doc.id, ...doc.data() };
}

/** PitchTable + AllowanceMaster を取得して MasterData を構築する */
async function getMasterData(): Promise<MasterData> {
  const [pitchSnap, allowanceSnap] = await Promise.all([
    collections.pitchTables.where("isActive", "==", true).get(),
    collections.allowanceMasters.where("isActive", "==", true).get(),
  ]);

  const pitchTable = pitchSnap.docs.map((d) => {
    const data: PitchTable = d.data();
    return { grade: data.grade, step: data.step, amount: data.amount };
  });

  const allowanceMaster = allowanceSnap.docs.map((d) => {
    const data: AllowanceMaster = d.data();
    return {
      allowanceType: data.allowanceType,
      code: data.code,
      name: data.name,
      amount: data.amount,
    };
  });

  return { pitchTable, allowanceMaster };
}

/** targetSalary に最も金額が近い Pitch エントリを返す */
function findNearestPitch(
  targetBaseSalary: number,
  pitchTable: MasterData["pitchTable"],
): MasterData["pitchTable"][number] | undefined {
  if (pitchTable.length === 0) return undefined;

  return pitchTable.reduce((nearest, entry) => {
    const nearestDiff = Math.abs(nearest.amount - targetBaseSalary);
    const entryDiff = Math.abs(entry.amount - targetBaseSalary);
    return entryDiff < nearestDiff ? entry : nearest;
  });
}

/** 翌月1日の Date を返す */
function getNextMonthFirst(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}
