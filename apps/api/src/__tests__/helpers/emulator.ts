import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const TEST_APP_NAME = "hr-system-integration-test";
const TEST_PROJECT_ID = "hr-system-test";

let _db: FirebaseFirestore.Firestore | null = null;

/**
 * Firestore エミュレータへの接続を初期化する。
 * FIRESTORE_EMULATOR_HOST 環境変数が設定されていることを前提とする
 * (例: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080)。
 *
 * テスト専用の名前付き Firebase アプリ ("hr-system-integration-test") を使用するため、
 * @hr-system/db がデフォルトアプリを初期化済みでも競合しない。
 */
export function setupEmulator(): FirebaseFirestore.Firestore {
  if (_db) return _db;

  const existing = getApps().find((a) => a.name === TEST_APP_NAME);
  const app = existing ?? initializeApp({ projectId: TEST_PROJECT_ID }, TEST_APP_NAME);

  _db = getFirestore(app);
  return _db;
}

/**
 * 指定したコレクションのドキュメントをすべて削除する。
 * テスト前後のクリーンアップに使用する。
 */
export async function clearCollections(
  db: FirebaseFirestore.Firestore,
  collectionNames: string[],
): Promise<void> {
  for (const name of collectionNames) {
    const snap = await db.collection(name).get();
    if (snap.empty) continue;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}
