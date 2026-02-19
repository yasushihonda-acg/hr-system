import { requireAccess } from "@/lib/access-control";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ホワイトリストチェック: 未許可ユーザーは /unauthorized へリダイレクト
  await requireAccess();
  return <>{children}</>;
}
