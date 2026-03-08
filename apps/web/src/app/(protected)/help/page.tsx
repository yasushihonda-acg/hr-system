"use client";

import {
  BarChart3,
  BookOpen,
  BotMessageSquare,
  CheckCircle2,
  ClipboardList,
  FileText,
  Inbox,
  KeyRound,
  ListTodo,
  LogIn,
  type LucideIcon,
  MessageSquare,
  Monitor,
  Shield,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/* ─────────────────────────── Types ─────────────────────────── */

interface TocEntry {
  id: string;
  num: string;
  label: string;
  icon: LucideIcon;
}

/* ─────────────────────────── Data ─────────────────────────── */

const tocItems: TocEntry[] = [
  { id: "login", num: "01", label: "ログイン", icon: LogIn },
  { id: "inbox", num: "02", label: "受信箱", icon: Inbox },
  { id: "task-board", num: "03", label: "タスクボード", icon: ListTodo },
  { id: "tasks", num: "04", label: "承認", icon: ClipboardList },
  { id: "dashboard", num: "05", label: "ダッシュボード", icon: BarChart3 },
  { id: "admin-users", num: "06", label: "ユーザー管理", icon: Users },
  { id: "admin-spaces", num: "07", label: "スペース管理", icon: MessageSquare },
  { id: "admin-employees", num: "08", label: "従業員一覧", icon: FileText },
  { id: "admin-audit-logs", num: "09", label: "監査ログ", icon: Shield },
  { id: "admin-ai-settings", num: "10", label: "AI設定", icon: BotMessageSquare },
  { id: "roles", num: "11", label: "権限一覧", icon: KeyRound },
];

const permissionData = [
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

function useActiveSection(ids: string[]) {
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

/* ─────────────────────────── Atoms ─────────────────────────── */

function SectionNumber({ num }: { num: string }) {
  return (
    <span
      aria-hidden
      className="absolute -left-2 -top-6 text-[5rem] font-black leading-none tracking-tighter select-none pointer-events-none"
      style={{
        background: "linear-gradient(135deg, var(--gradient-from), var(--gradient-to))",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        opacity: 0.06,
      }}
    >
      {num}
    </span>
  );
}

function Section({
  id,
  num,
  title,
  children,
}: {
  id: string;
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  return (
    <section
      ref={ref}
      id={id}
      className="relative scroll-mt-28 opacity-0 animate-[help-reveal_0.5s_ease_forwards]"
    >
      <SectionNumber num={num} />
      <div className="relative">
        <h2 className="text-type-heading font-bold mb-5 pb-3 border-b border-border/60 flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground/60 tracking-wider">{num}</span>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function BrowserFrame({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-6 max-w-lg">
      <div className="rounded-xl border border-border/80 bg-card shadow-[0_8px_32px_oklch(0.15_0.03_252/0.08),0_2px_8px_oklch(0.15_0.03_252/0.04)] overflow-hidden">
        {/* Browser dots bar */}
        <div className="flex items-center gap-1.5 px-3.5 py-2 bg-[oklch(0.96_0.006_240)] border-b border-border/40">
          <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.7_0.18_25/0.7)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.78_0.16_85/0.7)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.7_0.16_145/0.7)]" />
          <span className="ml-2 flex-1 h-5 rounded-md bg-[oklch(0.92_0.01_240)] border border-border/30" />
        </div>
        <Image src={src} alt={alt} width={540} height={960} className="w-full" priority={false} />
      </div>
      {caption && (
        <figcaption className="text-[0.7rem] text-muted-foreground/70 mt-2.5 text-center tracking-wide">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function Timeline({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative ml-3 pl-6 border-l-2 border-border/40 space-y-4 my-5">{children}</div>
  );
}

function TimelineStep({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className="relative">
      {/* Connector dot */}
      <span className="absolute -left-[1.9rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-accent text-[0.6rem] font-bold text-white shadow-sm">
        {num}
      </span>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function Callout({
  variant = "info",
  children,
}: {
  variant?: "info" | "warn";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-[oklch(0.55_0.16_230/0.06)] border-[oklch(0.55_0.16_230/0.3)] text-[oklch(0.35_0.12_230)]",
    warn: "bg-[oklch(0.65_0.18_75/0.08)] border-[oklch(0.65_0.18_75/0.3)] text-[oklch(0.4_0.12_75)]",
  };
  return (
    <div
      className={`relative border-l-[3px] px-4 py-3 rounded-r-lg my-5 text-sm ${styles[variant]}`}
    >
      {children}
    </div>
  );
}

function RoleBadge({ label }: { label: string }) {
  const colors: Record<string, string> = {
    管理者:
      "bg-[oklch(0.55_0.2_264/0.08)] text-[oklch(0.4_0.18_264)] border-[oklch(0.55_0.2_264/0.2)]",
    HRスタッフ:
      "bg-[oklch(0.55_0.16_230/0.08)] text-[oklch(0.4_0.14_230)] border-[oklch(0.55_0.16_230/0.2)]",
    閲覧者:
      "bg-[oklch(0.5_0.01_240/0.06)] text-[oklch(0.45_0.03_240)] border-[oklch(0.5_0.01_240/0.15)]",
  };
  return (
    <span
      className={`inline-flex items-center text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border tracking-wide ${colors[label] ?? ""}`}
    >
      {label}
    </span>
  );
}

function FeatureList({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2 my-4">{children}</ul>;
}

function Feature({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm">
      <span className="mt-1 flex-shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-ok)]" />
      </span>
      <span>
        <strong className="font-semibold">{label}</strong>
        <span className="text-muted-foreground"> — {children}</span>
      </span>
    </li>
  );
}

function PermissionDot({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[oklch(0.6_0.18_160/0.12)]">
      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-ok)]" />
    </span>
  ) : (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[oklch(0.5_0.01_240/0.06)]">
      <span className="w-1.5 h-0.5 rounded-full bg-[oklch(0.5_0.01_240/0.3)]" />
    </span>
  );
}

/* ─────────────────────────── Sidebar TOC ─────────────────────────── */

function TableOfContents({ active }: { active: string }) {
  return (
    <nav className="space-y-0.5">
      {tocItems.map((item) => {
        const isActive = active === item.id;
        const Icon = item.icon;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`
              group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200
              ${
                isActive
                  ? "bg-gradient-accent-soft text-foreground font-semibold shadow-[inset_0_0_0_1px_oklch(0.55_0.2_264/0.1)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }
            `}
          >
            <Icon
              className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                isActive
                  ? "text-[var(--gradient-from)]"
                  : "text-muted-foreground/50 group-hover:text-muted-foreground"
              }`}
            />
            <span className="truncate">{item.label}</span>
            {isActive && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gradient-accent flex-shrink-0" />
            )}
          </a>
        );
      })}
    </nav>
  );
}

/* ─────────────────────────── Main Page ─────────────────────────── */

export default function HelpPage() {
  const sectionIds = tocItems.map((t) => t.id);
  const activeSection = useActiveSection(sectionIds);

  return (
    <>
      {/* CSS Animation */}
      <style>{`
        @keyframes help-reveal {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex gap-10 max-w-6xl mx-auto">
        {/* ───── Sticky Sidebar TOC ───── */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-28">
            {/* Logo header */}
            <div className="flex items-center gap-2.5 mb-6 px-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-accent text-white shadow-sm">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">操作マニュアル</p>
                <p className="text-[0.6rem] text-muted-foreground/60 tracking-wider">GUIDE</p>
              </div>
            </div>

            <TableOfContents active={activeSection} />

            {/* Version badge */}
            <div className="mt-8 px-3">
              <span className="inline-flex items-center gap-1.5 text-[0.6rem] text-muted-foreground/50 tracking-wider">
                <Monitor className="w-3 h-3" />
                HR-AI Agent v1.0
              </span>
            </div>
          </div>
        </aside>

        {/* ───── Content ───── */}
        <div className="flex-1 min-w-0 pb-24 space-y-16">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-accent p-8 text-white shadow-[0_8px_32px_oklch(0.55_0.2_264/0.2)]">
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px),
                                radial-gradient(circle at 80% 20%, white 1px, transparent 1px),
                                radial-gradient(circle at 60% 80%, white 1px, transparent 1px)`,
                backgroundSize: "60px 60px, 80px 80px, 40px 40px",
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-5 w-5 opacity-80" />
                <span className="text-xs font-semibold tracking-widest uppercase opacity-70">
                  User Guide
                </span>
              </div>
              <h1 className="text-type-display font-extrabold mb-2 leading-tight">
                操作マニュアル
              </h1>
              <p className="text-sm opacity-80 max-w-md leading-relaxed">
                HR-AI Agent
                の全機能を網羅したガイドです。各セクションのスクリーンショットと操作手順で、はじめての方でもすぐに使い始められます。
              </p>
            </div>
          </div>

          {/* Mobile TOC */}
          <nav className="lg:hidden rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase">
              Contents
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {tocItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5 flex items-center gap-2"
                >
                  <span className="text-[0.6rem] font-mono text-muted-foreground/40">
                    {item.num}
                  </span>
                  {item.label}
                </a>
              ))}
            </div>
          </nav>

          {/* ===== Sections ===== */}

          {/* 01 ログイン */}
          <Section id="login" num="01" title="ログイン">
            <p className="text-sm mb-4 text-muted-foreground leading-relaxed">
              Google アカウント（社内ドメイン）でログインします。
              管理者が事前にユーザー登録したアカウントのみアクセスできます。
            </p>
            <BrowserFrame
              src="/screenshots/help/01-login.png"
              alt="ログイン画面"
              caption="ログイン画面 — 「Googleでログイン」をクリック"
            />
            <Timeline>
              <TimelineStep num={1}>ブラウザで HR-AI Agent の URL にアクセスします</TimelineStep>
              <TimelineStep num={2}>「Googleでログイン」ボタンをクリックします</TimelineStep>
              <TimelineStep num={3}>社内 Google アカウントで認証を完了します</TimelineStep>
              <TimelineStep num={4}>ログイン後、受信箱が表示されます</TimelineStep>
            </Timeline>
            <Callout>アクセスが拒否された場合は、管理者にユーザー登録を依頼してください。</Callout>
          </Section>

          {/* 02 受信箱 */}
          <Section id="inbox" num="02" title="受信箱">
            <p className="text-sm mb-3 text-muted-foreground leading-relaxed">
              Google Chat と LINE から届いたメッセージを一覧表示します。 AI
              が自動的にカテゴリ分類を行い、対応状況を管理できます。
            </p>
            <div className="flex items-center gap-2 mb-4">
              <RoleBadge label="管理者" />
              <RoleBadge label="HRスタッフ" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <BrowserFrame
                src="/screenshots/help/02-inbox-chat.png"
                alt="受信箱 - Google Chat"
                caption="Google Chat メッセージ一覧"
              />
              <BrowserFrame
                src="/screenshots/help/03-inbox-line.png"
                alt="受信箱 - LINE"
                caption="LINE メッセージ一覧"
              />
            </div>
            <h3 className="text-sm font-bold mt-6 mb-3">主な操作</h3>
            <Timeline>
              <TimelineStep num={1}>
                上部の「Google Chat」「LINE」タブでソースを切り替えます
              </TimelineStep>
              <TimelineStep num={2}>メッセージをクリックすると詳細を表示します</TimelineStep>
              <TimelineStep num={3}>
                詳細画面で対応ステータス（未対応→対応中→対応済）を変更できます
              </TimelineStep>
              <TimelineStep num={4}>AI が自動分類したカテゴリでフィルタできます</TimelineStep>
            </Timeline>
            <Callout>
              LINE タブでは画像メッセージもサムネイル表示されます。クリックで拡大表示できます。
            </Callout>
          </Section>

          {/* 03 タスクボード */}
          <Section id="task-board" num="03" title="タスクボード">
            <p className="text-sm mb-3 text-muted-foreground leading-relaxed">
              対応が必要なメッセージを優先度順にカード表示します。
              フィルタで絞り込みながら効率的にタスクを処理できます。
            </p>
            <div className="flex items-center gap-2 mb-4">
              <RoleBadge label="管理者" />
              <RoleBadge label="HRスタッフ" />
            </div>
            <BrowserFrame
              src="/screenshots/help/04-task-board.png"
              alt="タスクボード"
              caption="タスクボード — 優先度別のカード表示"
            />
            <h3 className="text-sm font-bold mt-6 mb-3">フィルタ機能</h3>
            <FeatureList>
              <Feature label="優先度">極高・高・中・低の4段階で絞り込み</Feature>
              <Feature label="ソース">Google Chat・LINE でフィルタ</Feature>
              <Feature label="ステータス">未対応・対応中・対応済で切り替え</Feature>
            </FeatureList>
            <Callout variant="warn">
              「極高」優先度のタスクは赤いバッジで強調表示されます。早急に対応してください。
            </Callout>
          </Section>

          {/* 04 承認 */}
          <Section id="tasks" num="04" title="承認（タスク一覧）">
            <p className="text-sm mb-3 text-muted-foreground leading-relaxed">
              AI が生成した給与変更ドラフトの承認ワークフローを管理します。 ドラフト → レビュー済 →
              社長承認待ち → 承認済の流れで処理します。
            </p>
            <div className="flex items-center gap-2 mb-4">
              <RoleBadge label="管理者" />
              <RoleBadge label="HRスタッフ" />
            </div>
            <BrowserFrame
              src="/screenshots/help/05-tasks.png"
              alt="承認一覧"
              caption="承認一覧 — ステータスタブで絞り込み"
            />
            <h3 className="text-sm font-bold mt-6 mb-3">承認フロー</h3>
            <Timeline>
              <TimelineStep num={1}>
                AI がチャットメッセージから給与変更内容を抽出し、ドラフトを自動作成します
              </TimelineStep>
              <TimelineStep num={2}>
                HR スタッフが内容を確認し「レビュー済」に変更します
              </TimelineStep>
              <TimelineStep num={3}>
                裁量的変更の場合、社長の承認が必要です（「社長承認待ち」ステータス）
              </TimelineStep>
              <TimelineStep num={4}>最終承認後、「承認済」となり処理が完了します</TimelineStep>
            </Timeline>
          </Section>

          {/* 05 ダッシュボード */}
          <Section id="dashboard" num="05" title="ダッシュボード">
            <p className="text-sm mb-3 text-muted-foreground leading-relaxed">
              メッセージの統計情報を可視化します。
              総メッセージ数、対応状況、カテゴリ別分布、推移グラフを確認できます。
            </p>
            <div className="flex items-center gap-2 mb-4">
              <RoleBadge label="管理者" />
              <RoleBadge label="HRスタッフ" />
              <RoleBadge label="閲覧者" />
            </div>
            <BrowserFrame
              src="/screenshots/help/07-dashboard.png"
              alt="ダッシュボード"
              caption="ダッシュボード — 統計カード・カテゴリ分布・推移グラフ"
            />
            <h3 className="text-sm font-bold mt-6 mb-3">表示項目</h3>
            <FeatureList>
              <Feature label="統計カード">総メッセージ数、今日・今週の件数、未対応数</Feature>
              <Feature label="対応状況バー">未対応・対応中・対応済・対応不要の割合</Feature>
              <Feature label="カテゴリ別分布">ドーナツチャートで10カテゴリの内訳を表示</Feature>
              <Feature label="メッセージ推移">直近30日の日別メッセージ数の折れ線グラフ</Feature>
            </FeatureList>
          </Section>

          {/* 06 ユーザー管理 */}
          <Section id="admin-users" num="06" title="管理: ユーザー">
            <p className="text-sm mb-3 text-muted-foreground leading-relaxed">
              ダッシュボードにアクセスできるユーザーを管理します。
              ロール（管理者・HRスタッフ・閲覧者）を割り当てます。
            </p>
            <div className="flex items-center gap-2 mb-4">
              <RoleBadge label="管理者" />
            </div>
            <BrowserFrame
              src="/screenshots/help/08-admin-users.png"
              alt="ユーザー管理"
              caption="ユーザー管理 — ロールとステータスを一覧表示"
            />
            <Timeline>
              <TimelineStep num={1}>「ユーザー追加」ボタンをクリックします</TimelineStep>
              <TimelineStep num={2}>メールアドレス、表示名、ロールを入力します</TimelineStep>
              <TimelineStep num={3}>
                追加されたユーザーは次回ログインからアクセス可能になります
              </TimelineStep>
            </Timeline>
          </Section>

          {/* 07 スペース管理 */}
          <Section id="admin-spaces" num="07" title="管理: スペース">
            <p className="text-sm mb-3 text-muted-foreground leading-relaxed">
              Google Chat のチャット同期対象スペースを管理します。
              スペースを追加するには、対象スペースに管理者アカウントが参加している必要があります。
            </p>
            <div className="flex items-center gap-2 mb-4">
              <RoleBadge label="管理者" />
            </div>
            <BrowserFrame
              src="/screenshots/help/09-admin-spaces.png"
              alt="スペース管理"
              caption="スペース管理 — 同期対象スペースの一覧"
            />
          </Section>

          {/* 08 従業員一覧 */}
          <Section id="admin-employees" num="08" title="管理: 従業員">
            <p className="text-sm mb-3 text-muted-foreground leading-relaxed">
              従業員マスタの一覧を表示します。
              社員番号、名前、雇用形態、部署、入社日などを確認できます。
            </p>
            <div className="flex items-center gap-2 mb-4">
              <RoleBadge label="管理者" />
            </div>
            <BrowserFrame
              src="/screenshots/help/11-admin-employees.png"
              alt="従業員一覧"
              caption="従業員一覧 — 全従業員のマスタ情報"
            />
          </Section>

          {/* 09 監査ログ */}
          <Section id="admin-audit-logs" num="09" title="管理: 監査ログ">
            <p className="text-sm mb-3 text-muted-foreground leading-relaxed">
              システム上の全操作を記録した監査ログを閲覧できます。
              ユーザーの追加・削除、ドラフトの承認など、重要な操作の履歴を確認できます。
            </p>
            <div className="flex items-center gap-2 mb-4">
              <RoleBadge label="管理者" />
            </div>
            <BrowserFrame
              src="/screenshots/help/12-admin-audit-logs.png"
              alt="監査ログ"
              caption="監査ログ — 管理者のみアクセス可能"
            />
            <Callout>
              監査ログは管理者ロールのみ閲覧可能です。
              閲覧権限がない場合はアクセス制限メッセージが表示されます。
            </Callout>
          </Section>

          {/* 10 AI設定 */}
          <Section id="admin-ai-settings" num="10" title="管理: AI設定">
            <p className="text-sm mb-3 text-muted-foreground leading-relaxed">
              AI によるメッセージ分類の設定を調整します。 正規表現ルール、LLM
              ルール、テスト分類、精度分析の4つのタブで管理します。
            </p>
            <div className="flex items-center gap-2 mb-4">
              <RoleBadge label="管理者" />
            </div>
            <BrowserFrame
              src="/screenshots/help/10-admin-ai-settings.png"
              alt="AI設定"
              caption="AI設定 — 10カテゴリの正規表現ルール一覧"
            />
            <h3 className="text-sm font-bold mt-6 mb-3">タブ説明</h3>
            <FeatureList>
              <Feature label="正規表現ルール">カテゴリごとのキーワード・パターンを編集</Feature>
              <Feature label="LLM ルール">AI 分類のシステムプロンプト・Few-shot 例を管理</Feature>
              <Feature label="テスト">サンプルテキストで分類結果をテスト</Feature>
              <Feature label="分類精度">正解ラベルとの比較で分類精度を分析</Feature>
            </FeatureList>
          </Section>

          {/* 11 権限一覧 */}
          <Section id="roles" num="11" title="権限一覧">
            <p className="text-sm mb-5 text-muted-foreground leading-relaxed">
              ユーザーのロールによってアクセスできる機能が異なります。
            </p>

            {/* Permission header */}
            <div className="rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-0 bg-[oklch(0.96_0.006_240)] px-5 py-3 border-b border-border/40">
                <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                  機能
                </span>
                <span className="w-20 text-center">
                  <RoleBadge label="管理者" />
                </span>
                <span className="w-20 text-center">
                  <RoleBadge label="HRスタッフ" />
                </span>
                <span className="w-20 text-center">
                  <RoleBadge label="閲覧者" />
                </span>
              </div>

              <div className="divide-y divide-border/30">
                {permissionData.map((row) => (
                  <div
                    key={row.feature}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-0 px-5 py-3 hover:bg-accent/30 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{row.feature}</p>
                      <p className="text-[0.65rem] text-muted-foreground/60">{row.desc}</p>
                    </div>
                    <span className="w-20 flex justify-center">
                      <PermissionDot allowed={row.admin} />
                    </span>
                    <span className="w-20 flex justify-center">
                      <PermissionDot allowed={row.hr} />
                    </span>
                    <span className="w-20 flex justify-center">
                      <PermissionDot allowed={row.viewer} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
