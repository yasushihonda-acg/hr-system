/**
 * Firestore ベースの UserStore 実装
 *
 * コレクション: mcp-users/{email}
 * ドキュメント構造: { role: "admin" | "readonly", enabled: boolean, createdAt, updatedAt }
 *
 * Cloud Run 上では ADC（Application Default Credentials）で認証。
 * SA `mcp-smarthr@` に Firestore User 権限が付与済み。
 */

import { Firestore } from "@google-cloud/firestore";
import type { Permission, Role } from "../middleware/pii-filter.js";

const COLLECTION = "mcp-users";

export interface UserDocument {
  role: Role;
  /** 細粒度パーミッション（省略時は role から自動導出） */
  permissions?: Permission[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export class FirestoreUserStore {
  private readonly db: Firestore;
  private readonly collection: string;

  constructor(options?: { projectId?: string; collection?: string }) {
    this.db = new Firestore({
      projectId: options?.projectId,
      // Cloud Run 上では ADC で自動認証
    });
    this.collection = options?.collection ?? COLLECTION;
  }

  async getUser(
    email: string,
  ): Promise<{ role: Role; permissions?: Permission[]; enabled: boolean } | null> {
    const doc = await this.db.collection(this.collection).doc(email).get();
    if (!doc.exists) return null;

    const data = doc.data() as UserDocument | undefined;
    if (!data) return null;

    return {
      role: data.role,
      permissions: data.permissions,
      enabled: data.enabled,
    };
  }

  /** ユーザーを追加・更新する（管理用） */
  async setUser(email: string, role: Role, enabled = true): Promise<void> {
    const now = new Date().toISOString();
    const ref = this.db.collection(this.collection).doc(email);
    const existing = await ref.get();

    if (existing.exists) {
      await ref.update({ role, enabled, updatedAt: now });
    } else {
      const doc: UserDocument = { role, enabled, createdAt: now, updatedAt: now };
      await ref.set(doc);
    }
  }

  /** ユーザー一覧を取得する（管理用） */
  async listUsers(): Promise<Array<{ email: string } & UserDocument>> {
    const snapshot = await this.db.collection(this.collection).get();
    return snapshot.docs.map((doc) => ({
      email: doc.id,
      ...(doc.data() as UserDocument),
    }));
  }
}
