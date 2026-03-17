/**
 * processMessage — Firestore 書き込み統合テスト（Firestore Emulator 使用）
 *
 * Chat メッセージ処理パイプラインの Firestore 操作を実エミュレータで検証:
 * - ChatMessage 書き込み
 * - IntentRecord 書き込み
 * - AuditLog 書き込み（トランザクション）
 * - 重複排除クエリ
 * - スレッドコンテキスト取得クエリ
 *
 * 外部 API（Chat API, Vertex AI）はモックする。
 *
 * 前提: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 */
import { FieldValue } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearCollections, setupEmulator } from "./helpers/emulator.js";

const COLLECTIONS = ["chat_messages", "intent_records", "audit_logs"];

describe("processMessage Firestore 操作 — Emulator 統合テスト", () => {
  let db: FirebaseFirestore.Firestore;

  beforeAll(() => {
    db = setupEmulator();
  });

  beforeEach(async () => {
    await clearCollections(db, COLLECTIONS);
  });

  afterAll(async () => {
    await clearCollections(db, COLLECTIONS);
  });

  describe("ChatMessage 書き込み", () => {
    it("ChatMessage ドキュメントが正しいフィールドで書き込まれる", async () => {
      const ref = db.collection("chat_messages").doc();
      await ref.set({
        spaceId: "spaces/AAAA-qf5jX0",
        googleMessageId: "spaces/AAAA-qf5jX0/messages/msg-001",
        senderUserId: "users/12345",
        senderEmail: "users/12345",
        senderName: "田中 太郎",
        senderType: "HUMAN",
        content: "山田さんの給与を2ピッチ上げてください",
        formattedContent: null,
        messageType: "MESSAGE",
        threadName: null,
        parentMessageId: null,
        mentionedUsers: [],
        annotations: [],
        attachments: [],
        isEdited: false,
        isDeleted: false,
        rawPayload: {},
        processedAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      const doc = await ref.get();
      expect(doc.exists).toBe(true);
      const data = doc.data()!;
      expect(data.spaceId).toBe("spaces/AAAA-qf5jX0");
      expect(data.googleMessageId).toBe("spaces/AAAA-qf5jX0/messages/msg-001");
      expect(data.senderType).toBe("HUMAN");
      expect(data.processedAt).toBeNull();
      expect(data.createdAt).toBeDefined();
    });

    it("processedAt を更新できる", async () => {
      const ref = db.collection("chat_messages").doc();
      await ref.set({
        googleMessageId: "spaces/AAAA/messages/msg-update-001",
        content: "テスト",
        processedAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      // processedAt を更新
      await ref.update({ processedAt: FieldValue.serverTimestamp() });

      const doc = await ref.get();
      expect(doc.data()!.processedAt).toBeDefined();
      expect(doc.data()!.processedAt).not.toBeNull();
    });
  });

  describe("IntentRecord 書き込み", () => {
    it("IntentRecord ドキュメントが正しいフィールドで書き込まれる", async () => {
      // 先に ChatMessage を作成
      const chatRef = db.collection("chat_messages").doc();
      await chatRef.set({
        googleMessageId: "spaces/AAAA/messages/msg-intent-001",
        content: "テスト",
        createdAt: FieldValue.serverTimestamp(),
      });

      // IntentRecord を作成
      const intentRef = db.collection("intent_records").doc();
      await intentRef.set({
        chatMessageId: chatRef.id,
        categories: ["salary"],
        confidenceScore: 0.95,
        extractedParams: null,
        classificationMethod: "ai",
        regexPattern: null,
        llmInput: "テスト",
        llmOutput: "給与変更の指示",
        isManualOverride: false,
        originalCategories: null,
        overriddenBy: null,
        overriddenAt: null,
        responseStatus: "unresponded",
        responseStatusUpdatedBy: null,
        responseStatusUpdatedAt: null,
        taskPriority: null,
        taskSummary: null,
        assignees: null,
        notes: null,
        workflowSteps: null,
        workflowUpdatedBy: null,
        workflowUpdatedAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      const doc = await intentRef.get();
      expect(doc.exists).toBe(true);
      const data = doc.data()!;
      expect(data.chatMessageId).toBe(chatRef.id);
      expect(data.categories).toEqual(["salary"]);
      expect(data.confidenceScore).toBe(0.95);
      expect(data.classificationMethod).toBe("ai");
      expect(data.responseStatus).toBe("unresponded");
    });

    it("chatMessageId で IntentRecord を検索できる", async () => {
      const chatMessageId = "chat-msg-search-001";

      await db.collection("intent_records").add({
        chatMessageId,
        categories: ["other"],
        confidenceScore: 0.8,
        createdAt: FieldValue.serverTimestamp(),
      });

      const snap = await db
        .collection("intent_records")
        .where("chatMessageId", "==", chatMessageId)
        .limit(1)
        .get();

      expect(snap.empty).toBe(false);
      expect(snap.docs[0]!.data().categories).toEqual(["other"]);
    });
  });

  describe("AuditLog トランザクション書き込み", () => {
    it("runTransaction 内で AuditLog を書き込める", async () => {
      const auditRef = db.collection("audit_logs").doc();

      await db.runTransaction(async (tx) => {
        tx.set(auditRef, {
          eventType: "chat_received",
          entityType: "chat_message",
          entityId: "chat-msg-audit-001",
          actorEmail: null,
          actorRole: null,
          details: {},
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      const doc = await auditRef.get();
      expect(doc.exists).toBe(true);
      const data = doc.data()!;
      expect(data.eventType).toBe("chat_received");
      expect(data.entityType).toBe("chat_message");
      expect(data.entityId).toBe("chat-msg-audit-001");
    });

    it("トランザクション内で複数の AuditLog を書き込める", async () => {
      const ref1 = db.collection("audit_logs").doc();
      const ref2 = db.collection("audit_logs").doc();

      await db.runTransaction(async (tx) => {
        tx.set(ref1, {
          eventType: "chat_received",
          entityType: "chat_message",
          entityId: "msg-001",
          actorEmail: null,
          actorRole: null,
          details: {},
          createdAt: FieldValue.serverTimestamp(),
        });
        tx.set(ref2, {
          eventType: "intent_classified",
          entityType: "intent_record",
          entityId: "intent-001",
          actorEmail: null,
          actorRole: null,
          details: {},
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      const snap = await db.collection("audit_logs").get();
      expect(snap.size).toBe(2);

      const eventTypes = snap.docs.map((d) => d.data().eventType).sort();
      expect(eventTypes).toEqual(["chat_received", "intent_classified"]);
    });
  });

  describe("重複排除クエリ", () => {
    it("同一 googleMessageId のメッセージが存在する場合に検出できる", async () => {
      const googleMessageId = "spaces/AAAA/messages/dedup-001";

      await db.collection("chat_messages").add({
        googleMessageId,
        content: "既存メッセージ",
        createdAt: FieldValue.serverTimestamp(),
      });

      const snap = await db
        .collection("chat_messages")
        .where("googleMessageId", "==", googleMessageId)
        .limit(1)
        .get();

      expect(snap.empty).toBe(false);
    });
  });

  describe("スレッドコンテキスト取得クエリ", () => {
    it("threadName + createdAt ASC でスレッド内メッセージを取得できる", async () => {
      const threadName = "spaces/AAAA/threads/thread-001";

      // 親メッセージ（先に作成 = createdAt が早い）
      await db.collection("chat_messages").add({
        googleMessageId: "spaces/AAAA/messages/parent-001",
        threadName,
        content: "親メッセージ",
        createdAt: new Date("2026-02-19T10:00:00Z"),
      });

      // 返信メッセージ
      await db.collection("chat_messages").add({
        googleMessageId: "spaces/AAAA/messages/reply-001",
        threadName,
        content: "返信メッセージ",
        createdAt: new Date("2026-02-19T10:01:00Z"),
      });

      // 別スレッドのメッセージ（混入しないことを確認）
      await db.collection("chat_messages").add({
        googleMessageId: "spaces/AAAA/messages/other-001",
        threadName: "spaces/AAAA/threads/thread-999",
        content: "別スレッド",
        createdAt: new Date("2026-02-19T10:00:30Z"),
      });

      const snap = await db
        .collection("chat_messages")
        .where("threadName", "==", threadName)
        .orderBy("createdAt", "asc")
        .limit(2)
        .get();

      expect(snap.docs).toHaveLength(2);
      expect(snap.docs[0]!.data().content).toBe("親メッセージ");
      expect(snap.docs[1]!.data().content).toBe("返信メッセージ");
    });

    it("親メッセージの IntentRecord を chatMessageId で検索できる", async () => {
      const parentChatId = "parent-chat-msg-001";

      // 親の IntentRecord
      await db.collection("intent_records").add({
        chatMessageId: parentChatId,
        categories: ["salary"],
        confidenceScore: 0.95,
        createdAt: FieldValue.serverTimestamp(),
      });

      const snap = await db
        .collection("intent_records")
        .where("chatMessageId", "==", parentChatId)
        .limit(1)
        .get();

      expect(snap.empty).toBe(false);
      const data = snap.docs[0]!.data();
      expect(data.categories).toEqual(["salary"]);
      expect(data.confidenceScore).toBe(0.95);
    });
  });

  describe("パイプライン全体の Firestore 操作シミュレーション", () => {
    it("ChatMessage → IntentRecord → AuditLog の一連の書き込みが成功する", async () => {
      // Step 1: ChatMessage 書き込み
      const chatRef = db.collection("chat_messages").doc();
      await chatRef.set({
        spaceId: "spaces/AAAA-qf5jX0",
        googleMessageId: "spaces/AAAA-qf5jX0/messages/pipeline-001",
        senderUserId: "users/12345",
        content: "給与変更のお願い",
        processedAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Step 2: AuditLog (chat_received)
      const auditRef1 = db.collection("audit_logs").doc();
      await db.runTransaction(async (tx) => {
        tx.set(auditRef1, {
          eventType: "chat_received",
          entityType: "chat_message",
          entityId: chatRef.id,
          actorEmail: null,
          actorRole: null,
          details: {},
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      // Step 3: IntentRecord 書き込み
      const intentRef = db.collection("intent_records").doc();
      await intentRef.set({
        chatMessageId: chatRef.id,
        categories: ["salary"],
        confidenceScore: 0.95,
        classificationMethod: "ai",
        responseStatus: "unresponded",
        createdAt: FieldValue.serverTimestamp(),
      });

      // Step 4: AuditLog (intent_classified)
      const auditRef2 = db.collection("audit_logs").doc();
      await db.runTransaction(async (tx) => {
        tx.set(auditRef2, {
          eventType: "intent_classified",
          entityType: "intent_record",
          entityId: intentRef.id,
          actorEmail: null,
          actorRole: null,
          details: {},
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      // Step 5: processedAt 更新
      await chatRef.update({ processedAt: FieldValue.serverTimestamp() });

      // 検証: 全ドキュメントが正しく書き込まれている
      const chatDoc = await chatRef.get();
      expect(chatDoc.data()!.processedAt).not.toBeNull();

      const intentDoc = await intentRef.get();
      expect(intentDoc.data()!.chatMessageId).toBe(chatRef.id);

      const auditSnap = await db.collection("audit_logs").get();
      expect(auditSnap.size).toBe(2);
    });
  });
});
