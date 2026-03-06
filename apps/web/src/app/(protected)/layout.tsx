import { Header } from "@/components/header";
import { SidebarNav } from "@/components/sidebar-nav";
import { requireAccess } from "@/lib/access-control";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ホワイトリストチェック: 未許可ユーザーは /unauthorized へリダイレクト
  await requireAccess();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
