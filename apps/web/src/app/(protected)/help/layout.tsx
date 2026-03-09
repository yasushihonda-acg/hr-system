import type { Metadata } from "next";
import { HelpOverflowFix } from "./overflow-fix";

export const metadata: Metadata = {
  title: "操作マニュアル | HR-AI Agent",
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HelpOverflowFix />
      {children}
    </>
  );
}
