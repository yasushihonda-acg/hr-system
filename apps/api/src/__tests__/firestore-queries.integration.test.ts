/**
 * Firestore クエリ統合テスト
 *
 * 目的:
 *   全 API ルートで使用する Firestore クエリパターンをエミュレータ上で実際に実行し、
 *   インデックス不足によるクエリエラーを CI で事前検知する。
 *
 * 実行方法:
 *   pnpm --filter @hr-system/api test:integration
 *   (エミュレータが 127.0.0.1:8080 で起動している必要がある)
 *
 * テスト戦略:
 *   各クエリに対して最小限のシードデータ (1件) を投入し、
 *   クエリが例外なく実行できることを検証する。
 *   結果の正確性は各ルートの単体テストに委ねる。
 */
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearCollections, setupEmulator } from "./helpers/emulator.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    "FIRESTORE_EMULATOR_HOST が設定されていません。\n" +
      "エミュレータを起動してから実行してください: pnpm emulator",
  );
}

const db = setupEmulator();
const NOW = Timestamp.now();

// テスト用定数
const SPACE_ID = "spaces/AAAA-integration-test";
const THREAD_NAME = "spaces/AAAA-integration-test/threads/thread-001";
const EMPLOYEE_ID = "emp-integration-001";
const DRAFT_ID = "draft-integration-001";
const ACTOR_EMAIL = "integration-test@example.com";

const ALL_COLLECTIONS = [
  "chat_messages",
  "intent_records",
  "salary_drafts",
  "employees",
  "audit_logs",
  "approval_logs",
  "salaries",
];

// ---------------------------------------------------------------------------
// セットアップ / クリーンアップ
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await clearCollections(db, ALL_COLLECTIONS);

  // chat_messages
  await db.collection("chat_messages").doc("msg-001").set({
    spaceId: SPACE_ID,
    threadName: THREAD_NAME,
    messageType: "MESSAGE",
    createdAt: NOW,
  });

  // intent_records (category フィルタ用)
  await db.collection("intent_records").doc("intent-001").set({
    chatMessageId: "msg-001",
    category: "salary_change",
    createdAt: NOW,
  });

  // salary_drafts
  await db.collection("salary_drafts").doc(DRAFT_ID).set({
    employeeId: EMPLOYEE_ID,
    status: "draft",
    createdAt: NOW,
  });

  // employees
  await db.collection("employees").doc(EMPLOYEE_ID).set({
    name: "統合テスト 太郎",
    employmentType: "full_time",
    department: "営業部",
    isActive: true,
    createdAt: NOW,
  });

  // audit_logs
  await db.collection("audit_logs").doc("audit-001").set({
    actorEmail: ACTOR_EMAIL,
    eventType: "DRAFT_CREATED",
    entityType: "salary_draft",
    entityId: DRAFT_ID,
    createdAt: NOW,
  });

  // approval_logs
  await db.collection("approval_logs").doc("log-001").set({
    draftId: DRAFT_ID,
    createdAt: NOW,
  });

  // salaries
  await db.collection("salaries").doc("salary-001").set({
    employeeId: EMPLOYEE_ID,
    effectiveFrom: NOW,
    createdAt: NOW,
  });
});

afterAll(async () => {
  await clearCollections(db, ALL_COLLECTIONS);
});

// ---------------------------------------------------------------------------
// chat_messages クエリ (chat-messages.ts)
// ---------------------------------------------------------------------------

describe("chat_messages クエリ", () => {
  it("threadName フィルタ + createdAt ASC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("chat_messages")
      .where("threadName", "==", THREAD_NAME)
      .orderBy("createdAt", "asc")
      .get();
    expect(snap).toBeDefined();
  });

  it("threadName フィルタ + createdAt DESC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("chat_messages")
      .where("threadName", "==", THREAD_NAME)
      .orderBy("createdAt", "desc")
      .get();
    expect(snap).toBeDefined();
  });

  it("spaceId フィルタ + createdAt DESC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("chat_messages")
      .where("spaceId", "==", SPACE_ID)
      .orderBy("createdAt", "desc")
      .get();
    expect(snap).toBeDefined();
  });

  it("messageType フィルタ + createdAt DESC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("chat_messages")
      .where("messageType", "==", "MESSAGE")
      .orderBy("createdAt", "desc")
      .get();
    expect(snap).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// intent_records クエリ (category フィルタ — chat-messages.ts)
// ---------------------------------------------------------------------------

describe("intent_records クエリ", () => {
  it("category フィルタ + createdAt DESC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("intent_records")
      .where("category", "==", "salary_change")
      .orderBy("createdAt", "desc")
      .get();
    expect(snap).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// salary_drafts クエリ (salary-drafts.ts)
// ---------------------------------------------------------------------------

describe("salary_drafts クエリ", () => {
  it("status フィルタ + createdAt DESC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("salary_drafts")
      .where("status", "==", "draft")
      .orderBy("createdAt", "desc")
      .get();
    expect(snap).toBeDefined();
  });

  it("employeeId フィルタ + createdAt DESC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("salary_drafts")
      .where("employeeId", "==", EMPLOYEE_ID)
      .orderBy("createdAt", "desc")
      .get();
    expect(snap).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// employees クエリ (employees.ts)
// ---------------------------------------------------------------------------

describe("employees クエリ", () => {
  it("employmentType フィルタ + name ASC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("employees")
      .where("employmentType", "==", "full_time")
      .orderBy("name", "asc")
      .get();
    expect(snap).toBeDefined();
  });

  it("department フィルタ + name ASC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("employees")
      .where("department", "==", "営業部")
      .orderBy("name", "asc")
      .get();
    expect(snap).toBeDefined();
  });

  it("isActive フィルタ + name ASC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("employees")
      .where("isActive", "==", true)
      .orderBy("name", "asc")
      .get();
    expect(snap).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// audit_logs クエリ (audit-logs.ts)
// ---------------------------------------------------------------------------

describe("audit_logs クエリ", () => {
  it("actorEmail フィルタ + createdAt DESC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("audit_logs")
      .where("actorEmail", "==", ACTOR_EMAIL)
      .orderBy("createdAt", "desc")
      .get();
    expect(snap).toBeDefined();
  });

  it("eventType フィルタ + createdAt DESC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("audit_logs")
      .where("eventType", "==", "DRAFT_CREATED")
      .orderBy("createdAt", "desc")
      .get();
    expect(snap).toBeDefined();
  });

  it("entityType フィルタ + createdAt DESC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("audit_logs")
      .where("entityType", "==", "salary_draft")
      .orderBy("createdAt", "desc")
      .get();
    expect(snap).toBeDefined();
  });

  it("entityId フィルタ + createdAt DESC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("audit_logs")
      .where("entityId", "==", DRAFT_ID)
      .orderBy("createdAt", "desc")
      .get();
    expect(snap).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// approval_logs クエリ (salary-drafts.ts)
// ---------------------------------------------------------------------------

describe("approval_logs クエリ", () => {
  it("draftId フィルタ + createdAt ASC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("approval_logs")
      .where("draftId", "==", DRAFT_ID)
      .orderBy("createdAt", "asc")
      .get();
    expect(snap).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// salaries クエリ (salary-drafts.ts / employees.ts)
// ---------------------------------------------------------------------------

describe("salaries クエリ", () => {
  it("employeeId フィルタ + effectiveFrom DESC — インデックスエラーなし", async () => {
    const snap = await db
      .collection("salaries")
      .where("employeeId", "==", EMPLOYEE_ID)
      .orderBy("effectiveFrom", "desc")
      .get();
    expect(snap).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// stats タイムライン クエリ (stats.ts)
// 同一フィールドの範囲クエリ → 単一フィールドインデックスで充足
// ---------------------------------------------------------------------------

describe("stats タイムライン クエリ", () => {
  it("createdAt 範囲クエリ + orderBy createdAt ASC — 単一フィールドインデックスで動作すること", async () => {
    const start = new Timestamp(NOW.seconds - 3600, 0); // 1時間前
    const end = new Timestamp(NOW.seconds + 3600, 0); // 1時間後

    const snap = await db
      .collection("intent_records")
      .where("createdAt", ">=", start)
      .where("createdAt", "<=", end)
      .orderBy("createdAt", "asc")
      .get();

    expect(snap).toBeDefined();
    expect(snap.docs.length).toBeGreaterThanOrEqual(1);
  });
});
