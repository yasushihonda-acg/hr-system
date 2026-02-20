/**
 * 構造化ロガー
 * - 開発: カラー付きプレーンテキスト
 * - 本番: JSON（Cloud Logging互換）
 * - PII保護: メールアドレスをマスクして出力
 */

const isDev = process.env.NODE_ENV === "development";

type Level = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const ANSI = {
  reset: "\x1b[0m",
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m", // green
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
} as const;

/** メールアドレスをマスク: ya***@aozora-cg.com */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = Math.min(2, local.length);
  return `${local.slice(0, visible)}***${domain}`;
}

/** オブジェクト中のメールキーを自動マスク */
function sanitize(ctx: LogContext): LogContext {
  const out: LogContext = {};
  for (const [k, v] of Object.entries(ctx)) {
    if ((k === "email" || k === "userEmail") && typeof v === "string") {
      out[k] = maskEmail(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: Level, message: string, ctx?: LogContext): void {
  const safe = ctx ? sanitize(ctx) : undefined;

  if (isDev) {
    const color = ANSI[level];
    const tag = `${color}[${level.toUpperCase().padEnd(5)}]${ANSI.reset}`;
    const ts = new Date().toTimeString().slice(0, 8);
    const extra = safe ? ` ${JSON.stringify(safe)}` : "";
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`${ANSI.debug}${ts}${ANSI.reset} ${tag} ${message}${extra}`);
  } else {
    const entry = {
      severity: level.toUpperCase(),
      timestamp: new Date().toISOString(),
      message,
      ...(safe && { context: safe }),
    };
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
};
