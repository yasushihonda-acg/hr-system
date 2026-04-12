/**
 * MCP ツール呼び出しの監査ログミドルウェア
 *
 * - Cloud Logging 互換の JSON 構造化ログを console.log で出力
 * - Firestore AuditLog コレクションへの書き込み（オプション、DI で注入）
 * - PII フィールドをマスキングして安全にログ記録
 */

import { randomUUID } from "node:crypto";

/** 監査ログエントリ */
export interface AuditLogEntry {
  timestamp: string;
  severity: "INFO" | "WARNING" | "ERROR";
  tool: string;
  userEmail: string;
  params: Record<string, unknown>;
  result: "success" | "error" | "denied";
  durationMs: number;
  requestId: string;
  source: "mcp-smarthr";
}

/** Firestore 書き込み用のインターフェース（DI） */
export interface AuditLogStore {
  write(entry: AuditLogEntry): Promise<void>;
}

/**
 * PII と判定するフィールド名パターン。
 * 値を "***" に置換する。
 */
const PII_FIELD_PATTERNS = [
  /email/i,
  /phone/i,
  /address/i,
  /birth/i,
  /salary/i,
  /wage/i,
  /pay/i,
  /bank/i,
  /account/i,
  /password/i,
  /secret/i,
  /token/i,
  /name/i,
  /my_?number/i,
  /social.*security/i,
  /ssn/i,
];

const PII_MASK = "***";

/**
 * パラメータオブジェクトの PII フィールドをマスクする。
 * ネストされたオブジェクトも再帰的に処理する。
 */
export function maskPII(params: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (PII_FIELD_PATTERNS.some((p) => p.test(key))) {
      masked[key] = PII_MASK;
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      masked[key] = maskPII(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export class AuditLogger {
  constructor(private readonly store?: AuditLogStore) {}

  /**
   * ツール呼び出しをラップして監査ログを記録する。
   *
   * - fn の実行結果（成功/失敗）と所要時間をログに記録
   * - params は PII マスク済みでログに含める
   * - store が提供されている場合は Firestore にも非同期書き込み（失敗してもツール実行には影響しない）
   */
  async logToolCall<T>(
    tool: string,
    userEmail: string,
    params: Record<string, unknown>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const requestId = randomUUID();
    const start = Date.now();
    let result: "success" | "error" = "success";
    let severity: AuditLogEntry["severity"] = "INFO";

    try {
      const value = await fn();
      return value;
    } catch (error) {
      result = "error";
      severity = "ERROR";
      throw error;
    } finally {
      const durationMs = Date.now() - start;
      const entry: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        severity,
        tool,
        userEmail,
        params: maskPII(params),
        result,
        durationMs,
        requestId,
        source: "mcp-smarthr",
      };
      this.emitLog(entry);
      this.persistLog(entry);
    }
  }

  /** 構造化ログを出力（Cloud Logging 互換） */
  private emitLog(entry: AuditLogEntry): void {
    console.log(JSON.stringify(entry));
  }

  /** Firestore に非同期書き込み（失敗してもツール実行には影響しない） */
  private persistLog(entry: AuditLogEntry): void {
    if (!this.store) return;
    this.store.write(entry).catch(() => {
      // Firestore 書き込み失敗はツール実行に影響させない
    });
  }
}
