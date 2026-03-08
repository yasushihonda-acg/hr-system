import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "操作マニュアル | HR-AI Agent",
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
