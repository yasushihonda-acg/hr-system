import { signIn } from "@/auth";

const isDev = process.env.NODE_ENV === "development";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      {/* 背景グリッドパターン */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(oklch(0.88 0.02 240 / 0.6) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.88 0.02 240 / 0.6) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
      {/* グロウ */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[oklch(0.73_0.18_55_/_0.08)] blur-3xl" />

      {/* カード */}
      <div className="relative z-10 w-full max-w-sm">
        {/* アクセントライン */}
        <div className="h-1 w-full rounded-t-xl bg-gradient-to-r from-primary via-[oklch(0.73_0.18_55)] to-primary" />
        <div className="rounded-b-xl border border-t-0 border-border bg-card px-8 py-10 shadow-lg shadow-primary/5">
          {/* ロゴ */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-md">
              <span className="text-lg font-bold text-primary-foreground">HR</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">HR-AI Agent</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              人事・給与変更の承認ダッシュボード
            </p>
          </div>

          {/* Google ログイン */}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent hover:shadow-md active:scale-[0.99]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google でログイン
            </button>
          </form>

          {/* 開発専用ログイン */}
          {isDev && (
            <div className="mt-6 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] text-white font-bold">
                  D
                </span>
                開発環境専用
              </p>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  const email = formData.get("email") as string;
                  await signIn("dev-login", { email, redirectTo: "/" });
                }}
                className="flex flex-col gap-2"
              >
                <input
                  type="email"
                  name="email"
                  defaultValue="yasushi.honda@aozora-cg.com"
                  required
                  className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="許可済みメールアドレス"
                />
                <button
                  type="submit"
                  className="rounded-md bg-[oklch(0.73_0.18_55)] px-4 py-2 text-sm font-medium text-[oklch(0.15_0.03_55)] transition-colors hover:bg-[oklch(0.68_0.16_55)]"
                >
                  開発ログイン
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* フッター注記 */}
      <p className="relative z-10 mt-6 text-xs text-muted-foreground">
        アクセスには管理者による許可が必要です
      </p>
    </main>
  );
}
