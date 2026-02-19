import type { Context } from "hono";

export type WorkerErrorCode =
  | "PARSE_ERROR"
  | "DUPLICATE_MESSAGE"
  | "EMPLOYEE_NOT_FOUND"
  | "SALARY_CALC_ERROR"
  | "LLM_ERROR"
  | "DB_ERROR"
  | "INTERNAL_ERROR";

/**
 * Worker 専用エラー。
 * shouldNack = true → Pub/Sub が NACK してリトライする（500を返す）。
 * shouldNack = false → ACK（200を返す）。ビジネスエラーや重複メッセージ。
 */
export class WorkerError extends Error {
  constructor(
    public readonly code: WorkerErrorCode,
    message: string,
    public readonly shouldNack: boolean = false,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WorkerError";
  }
}

export function workerErrorHandler(err: Error, c: Context): Response {
  if (err instanceof WorkerError) {
    if (err.shouldNack) {
      console.error(`[Worker NACK] ${err.code}: ${err.message}`, err.details ?? "");
      return c.json({ error: err.message }, 500);
    }
    // ビジネスエラー → ACK
    console.warn(`[Worker ACK] ${err.code}: ${err.message}`, err.details ?? "");
    return c.json({ ok: true }, 200);
  }
  console.error("[Worker Error]", err);
  return c.json({ error: "Internal server error" }, 500);
}
