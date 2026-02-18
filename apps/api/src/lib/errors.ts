import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export type ErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATUS_TRANSITION"
  | "VALIDATION_ERROR"
  | "INTERNAL_SERVER_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(entity: string, id: string): never {
  throw new AppError("NOT_FOUND", `${entity} が見つかりません: ${id}`, 404);
}

export function forbidden(message = "操作が禁止されています"): never {
  throw new AppError("FORBIDDEN", message, 403);
}

export function invalidTransition(
  currentStatus: string,
  toStatus: string,
  allowedActions: string[],
): never {
  throw new AppError("INVALID_STATUS_TRANSITION", "このステータスからは操作できません", 409, {
    current_status: currentStatus,
    requested_action: toStatus,
    allowed_actions: allowedActions,
  });
}

export function appErrorHandler(err: Error, c: Context): Response {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.httpStatus as 400 | 403 | 404 | 409 | 500,
    );
  }
  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: "INTERNAL_SERVER_ERROR" as ErrorCode, message: err.message } },
      err.status,
    );
  }
  console.error("[API Error]", err);
  return c.json(
    { error: { code: "INTERNAL_SERVER_ERROR" as ErrorCode, message: "Internal server error" } },
    500,
  );
}
