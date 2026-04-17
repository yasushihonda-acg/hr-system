/**
 * MCP ツール呼び出しの監査ログミドルウェア
 *
 * - Cloud Logging 互換の JSON 構造化ログを console.log で出力
 * - Firestore AuditLog コレクションへの書き込み（オプション、DI で注入）
 * - PII フィールドをマスキングして安全にログ記録（pii-filter.ts の maskPII を使用）
 */

import { randomUUID } from "node:crypto";
import type { AllowedBy } from "./auth.js";
import { maskPII } from "./pii-filter.js";

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
  /** 拒否理由（result === "denied" 時のみ） */
  reason?: string;
  /** Layer 2 の通過経路（domain / external_email_exception / denied） */
  allowedBy?: AllowedBy;
  source: "mcp-smarthr";
}

/** Firestore 書き込み用のインターフェース（DI） */
export interface AuditLogStore {
  write(entry: AuditLogEntry): Promise<void>;
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
  /**
   * 認可拒否を記録する（fn を実行しない）。
   * server.ts で denied と error を明確に分離するために使用。
   */
  async logDenied(
    tool: string,
    userEmail: string,
    params: Record<string, unknown>,
    reason: string,
    allowedBy?: AllowedBy,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      severity: "WARNING",
      tool,
      userEmail,
      params: maskPII(params) as Record<string, unknown>,
      result: "denied",
      durationMs: 0,
      requestId: randomUUID(),
      reason,
      allowedBy,
      source: "mcp-smarthr",
    };
    this.emitLog(entry);
    this.persistLog(entry);
  }

  async logToolCall<T>(
    tool: string,
    userEmail: string,
    params: Record<string, unknown>,
    fn: () => Promise<T>,
    allowedBy?: AllowedBy,
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
        params: maskPII(params) as Record<string, unknown>,
        result,
        durationMs,
        requestId,
        allowedBy,
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
    this.store.write(entry).catch((error) => {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "Audit log persistence failed",
          tool: entry.tool,
          requestId: entry.requestId,
          error: error instanceof Error ? error.message : String(error),
          source: "mcp-smarthr",
        }),
      );
    });
  }
}
