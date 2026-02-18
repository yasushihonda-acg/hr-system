import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HR-AI Agent",
  description: "人事・給与変更の承認ダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
