import { signIn } from "@/auth";

const isDev = process.env.NODE_ENV === "development";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">HR-AI Agent</h1>
        <p className="mt-2 text-muted-foreground">人事・給与変更の承認ダッシュボード</p>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90"
        >
          Google でログイン
        </button>
      </form>

      {isDev && (
        <div className="w-80 rounded-lg border border-dashed border-yellow-400 bg-yellow-50 p-4">
          <p className="mb-3 text-center text-xs font-medium text-yellow-700">
            開発環境専用ログイン
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
              className="rounded border border-yellow-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="許可済みメールアドレス"
            />
            <button
              type="submit"
              className="rounded bg-yellow-400 px-4 py-2 text-sm font-medium text-yellow-900 hover:bg-yellow-500"
            >
              開発ログイン
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
