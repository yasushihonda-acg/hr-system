"use client";

import {
  BarChart3,
  BotMessageSquare,
  ClipboardList,
  FileText,
  Inbox,
  KeyRound,
  ListTodo,
  LogIn,
  type LucideIcon,
  MessageSquare,
  Shield,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

/* ─────────────────────────── Types ─────────────────────────── */

export interface TocEntry {
  id: string;
  num: string;
  label: string;
  icon: LucideIcon;
}

export interface PermissionEntry {
  feature: string;
  desc: string;
  admin: boolean;
  hr: boolean;
  viewer: boolean;
}

/* ─────────────────────────── Data ─────────────────────────── */

export const tocItems: TocEntry[] = [
  { id: "login", num: "01", label: "ログイン", icon: LogIn },
  { id: "inbox", num: "02", label: "受信箱", icon: Inbox },
  { id: "task-board", num: "03", label: "タスクボード", icon: ListTodo },
  { id: "tasks", num: "04", label: "承認一覧", icon: ClipboardList },
  { id: "dashboard", num: "05", label: "ダッシュボード", icon: BarChart3 },
  { id: "admin-users", num: "06", label: "ユーザー管理", icon: Users },
  { id: "admin-spaces", num: "07", label: "スペース管理", icon: MessageSquare },
  { id: "admin-employees", num: "08", label: "従業員一覧", icon: FileText },
  { id: "admin-audit-logs", num: "09", label: "監査ログ", icon: Shield },
  { id: "admin-ai-settings", num: "10", label: "AI設定", icon: BotMessageSquare },
  { id: "roles", num: "11", label: "権限一覧", icon: KeyRound },
];

export const permissionData: PermissionEntry[] = [
  {
    feature: "受信箱",
    desc: "メッセージの閲覧・対応",
    admin: true,
    hr: true,
    viewer: false,
  },
  {
    feature: "タスクボード",
    desc: "優先度別タスク管理",
    admin: true,
    hr: true,
    viewer: false,
  },
  {
    feature: "承認ワークフロー",
    desc: "給与変更ドラフトの承認",
    admin: true,
    hr: true,
    viewer: false,
  },
  {
    feature: "ダッシュボード",
    desc: "統計・分析の閲覧",
    admin: true,
    hr: true,
    viewer: true,
  },
  {
    feature: "ユーザー管理",
    desc: "アカウントの追加・編集",
    admin: true,
    hr: false,
    viewer: false,
  },
  {
    feature: "スペース管理",
    desc: "Chat同期対象の管理",
    admin: true,
    hr: false,
    viewer: false,
  },
  {
    feature: "従業員一覧",
    desc: "従業員マスタの閲覧",
    admin: true,
    hr: false,
    viewer: false,
  },
  {
    feature: "監査ログ",
    desc: "操作履歴の閲覧",
    admin: true,
    hr: false,
    viewer: false,
  },
  {
    feature: "AI設定",
    desc: "分類ルールの編集",
    admin: true,
    hr: false,
    viewer: false,
  },
];

/* ─────────────────────────── Hooks ─────────────────────────── */

export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [ids]);

  return active;
}
