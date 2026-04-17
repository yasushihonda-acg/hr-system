/**
 * Firestore ベースの UserStore 実装
 *
 * コレクション: mcp-users/{email}
 * ドキュメント構造: { role, permissions?, enabled, external?, approvedBy?, approvedAt?, reason?, createdAt, updatedAt }
 *
 * `external`, `approvedBy`, `approvedAt`, `reason` は外部 readonly 例外ユーザーの
 * 運用メタデータ（監査用）。権限判定は EXTERNAL_READONLY_EMAIL_ALLOWLIST 環境変数と
 * role / permissions で行うため、これらのフィールドは参考情報。
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
  /** 外部テナントユーザー（allowedDomain 外）の例外許可を示すメタデータ */
  external?: boolean;
  /** 外部例外の承認者（運用ログ用） */
  approvedBy?: string;
  /** 外部例外の承認日時（ISO 8601） */
  approvedAt?: string;
  /** 外部例外の理由（運用ログ用） */
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

/** setUser の任意メタデータ */
export interface UserMetadata {
  permissions?: Permission[];
  external?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  reason?: string;
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

  /**
   * ユーザーを追加・更新する（管理用）。
   * metadata を渡すと permissions / external / approvedBy / approvedAt / reason を設定する。
   */
  async setUser(email: string, role: Role, enabled = true, metadata?: UserMetadata): Promise<void> {
    const now = new Date().toISOString();
    const ref = this.db.collection(this.collection).doc(email);
    const existing = await ref.get();

    const metaFields: Partial<UserDocument> = {};
    if (metadata?.permissions !== undefined) metaFields.permissions = metadata.permissions;
    if (metadata?.external !== undefined) metaFields.external = metadata.external;
    if (metadata?.approvedBy !== undefined) metaFields.approvedBy = metadata.approvedBy;
    if (metadata?.approvedAt !== undefined) metaFields.approvedAt = metadata.approvedAt;
    if (metadata?.reason !== undefined) metaFields.reason = metadata.reason;

    if (existing.exists) {
      await ref.update({ role, enabled, ...metaFields, updatedAt: now });
    } else {
      const doc: UserDocument = {
        role,
        enabled,
        ...metaFields,
        createdAt: now,
        updatedAt: now,
      };
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
