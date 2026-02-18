import { zValidator } from "@hono/zod-validator";
import { collections, db, type SalaryDraft } from "@hr-system/db";
import {
  type ApprovalAction,
  type AuditEventType,
  DRAFT_STATUSES,
  type DraftStatus,
  getNextActions,
  validateTransition,
} from "@hr-system/shared";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Hono } from "hono";
import { z } from "zod";
import { AppError, forbidden, invalidTransition, notFound } from "../lib/errors.js";
import { parsePagination } from "../lib/pagination.js";
import { toISO, toISOOrNull } from "../lib/serialize.js";

// ---------------------------------------------------------------------------
// Zod スキーマ
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  status: z.enum(DRAFT_STATUSES).optional(),
  employeeId: z.string().optional(),
  changeType: z.enum(["mechanical", "discretionary"]).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const patchDraftSchema = z
  .object({
    beforeBaseSalary: z.number().int().positive().optional(),
    afterBaseSalary: z.number().int().positive().optional(),
    beforeTotal: z.number().int().positive().optional(),
    afterTotal: z.number().int().positive().optional(),
    effectiveDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で指定してください")
      .optional(),
    reason: z.string().max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "更新するフィールドを1つ以上指定してください",
  });

const transitionSchema = z.object({
  toStatus: z.enum(DRAFT_STATUSES),
  comment: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/** ステータス遷移 → ApprovalLog アクション のマッピング */
function toApprovalAction(toStatus: DraftStatus): ApprovalAction {
  if (toStatus === "reviewed" || toStatus === "pending_ceo_approval") return "reviewed";
  if (toStatus === "approved") return "approved";
  return "rejected"; // rejected / draft (差し戻し)
}

/** Firestore ドキュメントを API レスポンス形式に変換 */
function serializeDraft(id: string, data: SalaryDraft) {
  return {
    id,
    employeeId: data.employeeId,
    chatMessageId: data.chatMessageId,
    status: data.status,
    changeType: data.changeType,
    reason: data.reason,
    beforeBaseSalary: data.beforeBaseSalary,
    afterBaseSalary: data.afterBaseSalary,
    beforeTotal: data.beforeTotal,
    afterTotal: data.afterTotal,
    effectiveDate: toISO(data.effectiveDate),
    aiConfidence: data.aiConfidence,
    aiReasoning: data.aiReasoning,
    appliedRules: data.appliedRules,
    reviewedBy: data.reviewedBy,
    reviewedAt: toISOOrNull(data.reviewedAt),
    approvedBy: data.approvedBy,
    approvedAt: toISOOrNull(data.approvedAt),
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// ルート定義
// ---------------------------------------------------------------------------

const app = new Hono();

/**
 * GET /api/salary-drafts
 * 給与ドラフト一覧（フィルタ・ページネーション）
 */
app.get("/", zValidator("query", listQuerySchema), async (c) => {
  const { status, employeeId, changeType } = c.req.valid("query");
  const { limit, offset } = parsePagination(c.req.query());

  // クエリビルド（複数フィルタには Firestore composite index が必要）
  // NOTE: 本番環境では firestore.indexes.json に composite index を定義すること
  let query = collections.salaryDrafts.orderBy("createdAt", "desc") as FirebaseFirestore.Query;
  if (status) query = query.where("status", "==", status);
  if (employeeId) query = query.where("employeeId", "==", employeeId);
  if (changeType) query = query.where("changeType", "==", changeType);

  const [countSnap, docsSnap] = await Promise.all([
    query.count().get(),
    query.limit(limit).offset(offset).get(),
  ]);

  const total = countSnap.data().count;
  const drafts = docsSnap.docs.map((doc) => serializeDraft(doc.id, doc.data() as SalaryDraft));

  return c.json({ drafts, total, limit, offset });
});

/**
 * GET /api/salary-drafts/:id
 * 給与ドラフト詳細（明細 + 承認履歴）
 */
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const [draftSnap, itemsSnap, logsSnap] = await Promise.all([
    collections.salaryDrafts.doc(id).get(),
    collections.salaryDraftItems.where("draftId", "==", id).get(),
    collections.approvalLogs.where("draftId", "==", id).orderBy("createdAt", "asc").get(),
  ]);

  if (!draftSnap.exists) notFound("SalaryDraft", id);
  const draft = draftSnap.data() as SalaryDraft;

  const items = itemsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const approvalLogs = logsSnap.docs.map((doc) => {
    const log = doc.data();
    return {
      id: doc.id,
      action: log.action,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      actorEmail: log.actorEmail,
      actorRole: log.actorRole,
      comment: log.comment,
      modifiedFields: log.modifiedFields,
      createdAt: toISO(log.createdAt),
    };
  });

  // 現在のロールで実行可能な次アクションを付与
  const actorRole = c.get("actorRole");
  const nextActions = getNextActions(draft.status, actorRole, draft.changeType);

  return c.json({
    ...serializeDraft(id, draft),
    items,
    approvalLogs,
    nextActions,
  });
});

/**
 * PATCH /api/salary-drafts/:id
 * ドラフト修正（draft / reviewed のみ許可）
 */
app.patch("/:id", zValidator("json", patchDraftSchema), async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const actorRole = c.get("actorRole");

  // hr_staff / hr_manager のみ修正可能
  if (actorRole === "ceo") {
    forbidden("CEOはドラフトを直接修正できません");
  }

  const draftRef = collections.salaryDrafts.doc(id);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) notFound("SalaryDraft", id);

  const draft = draftSnap.data() as SalaryDraft;
  if (draft.status !== "draft" && draft.status !== "reviewed") {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      "draft または reviewed のステータスのみ修正できます",
      409,
      { current_status: draft.status },
    );
  }

  const body = c.req.valid("json");

  // 更新データ構築
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (body.beforeBaseSalary !== undefined) updateData.beforeBaseSalary = body.beforeBaseSalary;
  if (body.afterBaseSalary !== undefined) updateData.afterBaseSalary = body.afterBaseSalary;
  if (body.beforeTotal !== undefined) updateData.beforeTotal = body.beforeTotal;
  if (body.afterTotal !== undefined) updateData.afterTotal = body.afterTotal;
  if (body.reason !== undefined) updateData.reason = body.reason;
  if (body.effectiveDate !== undefined) {
    updateData.effectiveDate = Timestamp.fromDate(new Date(`${body.effectiveDate}T00:00:00Z`));
  }

  // 変更前フィールドを記録
  const modifiedFields: Record<string, unknown> = {};
  for (const key of Object.keys(body) as (keyof typeof body)[]) {
    const before = draft[key as keyof typeof draft];
    const after = body[key];
    if (before !== undefined) modifiedFields[key] = { before, after };
  }

  // バッチ書き込み（ドラフト更新 + 監査ログ）
  const batch = db.batch();
  batch.update(draftRef, updateData);
  batch.set(collections.auditLogs.doc(), {
    eventType: "draft_modified" as AuditEventType,
    entityType: "SalaryDraft",
    entityId: id,
    actorEmail: user.email,
    actorRole,
    details: { modifiedFields },
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  // 更新後のドラフトを返却
  const updatedSnap = await draftRef.get();
  return c.json(serializeDraft(id, updatedSnap.data() as SalaryDraft));
});

/**
 * POST /api/salary-drafts/:id/transition
 * ステータス遷移（review / approve / reject / 差し戻し）
 */
app.post("/:id/transition", zValidator("json", transitionSchema), async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const actorRole = c.get("actorRole");
  const { toStatus, comment } = c.req.valid("json");

  const draftRef = collections.salaryDrafts.doc(id);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) notFound("SalaryDraft", id);

  const draft = draftSnap.data() as SalaryDraft;
  const fromStatus = draft.status;

  // 遷移バリデーション（状態 + ロール + 変更タイプをチェック）
  const result = validateTransition(fromStatus, toStatus, actorRole, draft.changeType);
  if (!result.valid) {
    const allowed = getNextActions(fromStatus, actorRole, draft.changeType);
    invalidTransition(fromStatus, toStatus, allowed);
  }

  // ドラフト更新データ
  const draftUpdate: Record<string, unknown> = {
    status: toStatus,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (toStatus === "reviewed") {
    draftUpdate.reviewedBy = user.email;
    draftUpdate.reviewedAt = FieldValue.serverTimestamp();
  } else if (toStatus === "approved") {
    draftUpdate.approvedBy = user.email;
    draftUpdate.approvedAt = FieldValue.serverTimestamp();
  }

  // 承認ログ
  const approvalLogData = {
    draftId: id,
    action: toApprovalAction(toStatus) as ApprovalAction,
    fromStatus,
    toStatus,
    actorEmail: user.email,
    actorRole,
    comment: comment ?? null,
    modifiedFields: null,
    createdAt: FieldValue.serverTimestamp(),
  };

  // 監査ログ
  const auditLogData = {
    eventType: "status_changed" as AuditEventType,
    entityType: "SalaryDraft",
    entityId: id,
    actorEmail: user.email,
    actorRole,
    details: { fromStatus, toStatus, comment: comment ?? null },
    createdAt: FieldValue.serverTimestamp(),
  };

  // バッチ書き込み（ドラフト更新 + 承認ログ + 監査ログ）
  const batch = db.batch();
  batch.update(draftRef, draftUpdate);
  batch.set(collections.approvalLogs.doc(), approvalLogData);
  batch.set(collections.auditLogs.doc(), auditLogData);
  await batch.commit();

  // 更新後のドラフトと次アクション一覧を返却
  const updatedSnap = await draftRef.get();
  const updated = updatedSnap.data() as SalaryDraft;
  const nextActions = getNextActions(toStatus, actorRole, updated.changeType);

  return c.json({
    ...serializeDraft(id, updated),
    nextActions,
  });
});

/**
 * GET /api/salary-drafts/:id/approval-logs
 * 承認履歴
 */
app.get("/:id/approval-logs", async (c) => {
  const id = c.req.param("id");

  const draftSnap = await collections.salaryDrafts.doc(id).get();
  if (!draftSnap.exists) notFound("SalaryDraft", id);

  const logsSnap = await collections.approvalLogs
    .where("draftId", "==", id)
    .orderBy("createdAt", "asc")
    .get();

  const logs = logsSnap.docs.map((doc) => {
    const log = doc.data();
    return {
      id: doc.id,
      action: log.action,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      actorEmail: log.actorEmail,
      actorRole: log.actorRole,
      comment: log.comment,
      modifiedFields: log.modifiedFields,
      createdAt: toISO(log.createdAt),
    };
  });

  return c.json({ draftId: id, logs });
});

export { app as salaryDraftRoutes };
