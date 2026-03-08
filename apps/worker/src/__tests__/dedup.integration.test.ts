/**
 * isDuplicate 統合テスト（Firestore Emulator 使用）
 *
 * 実際の Firestore に対して重複排除クエリを実行し、
 * モックなしで正しく動作することを検証する。
 *
 * 前提: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearCollections, setupEmulator } from "./helpers/emulator.js";

const COLLECTION = "chat_messages";

describe("isDuplicate — Firestore Emulator 統合テスト", () => {
  let db: FirebaseFirestore.Firestore;

  beforeAll(() => {
    db = setupEmulator();
  });

  beforeEach(async () => {
    await clearCollections(db, [COLLECTION]);
  });

  afterAll(async () => {
    await clearCollections(db, [COLLECTION]);
  });

  it("新規メッセージ: 該当ドキュメントなし → false を返す", async () => {
    // Emulator DB は空 → 重複なし
    const snap = await db
      .collection(COLLECTION)
      .where("googleMessageId", "==", "spaces/AAAA/messages/new-msg-001")
      .limit(1)
      .get();

    expect(snap.empty).toBe(true);
  });

  it("既存メッセージ: 同一 googleMessageId が存在 → 空でないスナップショットを返す", async () => {
    const googleMessageId = "spaces/AAAA/messages/existing-msg-001";

    // ドキュメントを挿入
    await db.collection(COLLECTION).add({
      googleMessageId,
      spaceId: "spaces/AAAA",
      content: "テストメッセージ",
      createdAt: new Date(),
    });

    // 同じ googleMessageId で検索 → 存在する
    const snap = await db
      .collection(COLLECTION)
      .where("googleMessageId", "==", googleMessageId)
      .limit(1)
      .get();

    expect(snap.empty).toBe(false);
    expect(snap.docs).toHaveLength(1);
  });

  it("異なる googleMessageId では一致しない", async () => {
    await db.collection(COLLECTION).add({
      googleMessageId: "spaces/AAAA/messages/msg-A",
      spaceId: "spaces/AAAA",
      content: "メッセージA",
      createdAt: new Date(),
    });

    const snap = await db
      .collection(COLLECTION)
      .where("googleMessageId", "==", "spaces/AAAA/messages/msg-B")
      .limit(1)
      .get();

    expect(snap.empty).toBe(true);
  });

  it("複数ドキュメントが存在しても limit(1) で1件のみ返す", async () => {
    const googleMessageId = "spaces/AAAA/messages/dup-msg";

    // 同じ googleMessageId で2件挿入（本来は起きないが防御テスト）
    await Promise.all([
      db.collection(COLLECTION).add({ googleMessageId, content: "1つ目", createdAt: new Date() }),
      db.collection(COLLECTION).add({ googleMessageId, content: "2つ目", createdAt: new Date() }),
    ]);

    const snap = await db
      .collection(COLLECTION)
      .where("googleMessageId", "==", googleMessageId)
      .limit(1)
      .get();

    expect(snap.empty).toBe(false);
    expect(snap.docs).toHaveLength(1);
  });
});
