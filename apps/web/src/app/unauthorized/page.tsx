import { signOut } from "@/auth";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="text-center">
        <ShieldX className="mx-auto h-16 w-16 text-destructive" />
        <h1 className="mt-4 text-3xl font-bold">アクセス権限がありません</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          このダッシュボードは許可されたユーザーのみアクセスできます。
          アクセスが必要な場合は管理者にお問い合わせください。
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90"
        >
          ログイン画面に戻る
        </button>
      </form>
    </main>
  );
}
