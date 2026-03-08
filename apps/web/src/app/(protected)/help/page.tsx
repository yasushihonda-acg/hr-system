import { BookOpen, HelpCircle } from "lucide-react";
import Image from "next/image";

export const metadata = {
  title: "操作マニュアル | HR-AI Agent",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-type-heading font-bold mb-4 border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Screenshot({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-4">
      <div className="rounded-lg border border-border overflow-hidden shadow-sm">
        <Image
          src={src}
          alt={alt}
          width={540}
          height={960}
          className="w-full max-w-md mx-auto"
          priority={false}
        />
      </div>
      {caption && (
        <figcaption className="text-xs text-muted-foreground mt-2 text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function StepList({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal list-inside space-y-2 my-3 ml-2">{children}</ol>;
}

function Step({ children }: { children: React.ReactNode }) {
  return <li className="text-sm leading-relaxed">{children}</li>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 px-4 py-3 rounded-r-lg my-4 text-sm text-blue-800">
      {children}
    </div>
  );
}

function RoleBadge({ label }: { label: string }) {
  const colors: Record<string, string> = {
    管理者: "bg-purple-100 text-purple-700 border-purple-300",
    HRスタッフ: "bg-blue-100 text-blue-700 border-blue-300",
    閲覧者: "bg-gray-100 text-gray-600 border-gray-300",
  };
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded-full border ${colors[label] ?? "bg-gray-100 text-gray-600 border-gray-300"}`}
    >
      {label}
    </span>
  );
}

const tocItems = [
  { id: "login", label: "ログイン" },
  { id: "inbox", label: "受信箱" },
  { id: "task-board", label: "タスクボード" },
  { id: "tasks", label: "承認（タスク一覧）" },
  { id: "dashboard", label: "ダッシュボード" },
  { id: "admin-users", label: "管理: ユーザー" },
  { id: "admin-spaces", label: "管理: スペース" },
  { id: "admin-employees", label: "管理: 従業員" },
  { id: "admin-audit-logs", label: "管理: 監査ログ" },
  { id: "admin-ai-settings", label: "管理: AI設定" },
  { id: "roles", label: "権限一覧" },
];

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto pb-20">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-accent text-white">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-type-heading font-bold">操作マニュアル</h1>
          <p className="text-sm text-muted-foreground">HR-AI Agent の各機能の使い方を説明します</p>
        </div>
      </div>

      {/* 目次 */}
      <nav className="mb-10 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          目次
        </h2>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {tocItems.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-12">
        {/* ログイン */}
        <Section id="login" title="ログイン">
          <p className="text-sm mb-3">
            Google
            アカウント（社内ドメイン）でログインします。管理者が事前にユーザー登録したアカウントのみアクセスできます。
          </p>
          <Screenshot
            src="/screenshots/help/01-login.png"
            alt="ログイン画面"
            caption="ログイン画面 — 「Googleでログイン」をクリック"
          />
          <StepList>
            <Step>ブラウザで HR-AI Agent の URL にアクセスします</Step>
            <Step>「Googleでログイン」ボタンをクリックします</Step>
            <Step>社内 Google アカウントで認証を完了します</Step>
            <Step>ログイン後、受信箱が表示されます</Step>
          </StepList>
          <Tip>アクセスが拒否された場合は、管理者にユーザー登録を依頼してください。</Tip>
        </Section>

        {/* 受信箱 */}
        <Section id="inbox" title="受信箱">
          <p className="text-sm mb-3">
            Google Chat と LINE から届いたメッセージを一覧表示します。AI
            が自動的にカテゴリ分類を行い、対応状況を管理できます。
          </p>
          <div className="flex items-center gap-2 mb-3">
            <RoleBadge label="管理者" />
            <RoleBadge label="HRスタッフ" />
          </div>
          <Screenshot
            src="/screenshots/help/02-inbox-chat.png"
            alt="受信箱 - Google Chat タブ"
            caption="受信箱 — Google Chat メッセージ一覧"
          />
          <Screenshot
            src="/screenshots/help/03-inbox-line.png"
            alt="受信箱 - LINE タブ"
            caption="受信箱 — LINE メッセージ一覧"
          />
          <h3 className="text-sm font-semibold mt-6 mb-2">主な操作</h3>
          <StepList>
            <Step>上部の「Google Chat」「LINE」タブでソースを切り替えます</Step>
            <Step>メッセージをクリックすると詳細を表示します</Step>
            <Step>詳細画面で対応ステータス（未対応→対応中→対応済）を変更できます</Step>
            <Step>AI が自動分類したカテゴリ（給与・社保、退職・休職 等）でフィルタできます</Step>
          </StepList>
          <Tip>
            LINE タブでは画像メッセージもサムネイル表示されます。クリックで拡大表示できます。
          </Tip>
        </Section>

        {/* タスクボード */}
        <Section id="task-board" title="タスクボード">
          <p className="text-sm mb-3">
            対応が必要なメッセージを優先度順にカード表示します。フィルタで絞り込みながら効率的にタスクを処理できます。
          </p>
          <div className="flex items-center gap-2 mb-3">
            <RoleBadge label="管理者" />
            <RoleBadge label="HRスタッフ" />
          </div>
          <Screenshot
            src="/screenshots/help/04-task-board.png"
            alt="タスクボード"
            caption="タスクボード — 優先度別のカード表示"
          />
          <h3 className="text-sm font-semibold mt-6 mb-2">フィルタ機能</h3>
          <ul className="list-disc list-inside text-sm space-y-1 ml-2">
            <li>
              <strong>優先度</strong>: 極高・高・中・低
            </li>
            <li>
              <strong>ソース</strong>: Google Chat・LINE
            </li>
            <li>
              <strong>ステータス</strong>: 未対応・対応中・対応済
            </li>
          </ul>
          <Tip>「極高」優先度のタスクは赤いバッジで強調表示されます。早急に対応してください。</Tip>
        </Section>

        {/* 承認一覧 */}
        <Section id="tasks" title="承認（タスク一覧）">
          <p className="text-sm mb-3">
            AI
            が生成した給与変更ドラフトの承認ワークフローを管理します。ドラフト→レビュー済→社長承認待ち→承認済の流れで処理します。
          </p>
          <div className="flex items-center gap-2 mb-3">
            <RoleBadge label="管理者" />
            <RoleBadge label="HRスタッフ" />
          </div>
          <Screenshot
            src="/screenshots/help/05-tasks.png"
            alt="承認一覧"
            caption="承認一覧 — ステータスタブで絞り込み"
          />
          <h3 className="text-sm font-semibold mt-6 mb-2">承認フロー</h3>
          <StepList>
            <Step>AI がチャットメッセージから給与変更内容を抽出し、ドラフトを自動作成します</Step>
            <Step>HR スタッフが内容を確認し「レビュー済」に変更します</Step>
            <Step>裁量的変更の場合、社長の承認が必要です（「社長承認待ち」ステータス）</Step>
            <Step>最終承認後、「承認済」となり処理が完了します</Step>
          </StepList>
        </Section>

        {/* ダッシュボード */}
        <Section id="dashboard" title="ダッシュボード">
          <p className="text-sm mb-3">
            メッセージの統計情報を可視化します。総メッセージ数、対応状況、カテゴリ別分布、推移グラフを確認できます。
          </p>
          <div className="flex items-center gap-2 mb-3">
            <RoleBadge label="管理者" />
            <RoleBadge label="HRスタッフ" />
            <RoleBadge label="閲覧者" />
          </div>
          <Screenshot
            src="/screenshots/help/07-dashboard.png"
            alt="ダッシュボード"
            caption="ダッシュボード — 統計カード・カテゴリ分布・推移グラフ"
          />
          <h3 className="text-sm font-semibold mt-6 mb-2">表示項目</h3>
          <ul className="list-disc list-inside text-sm space-y-1 ml-2">
            <li>
              <strong>統計カード</strong>: 総メッセージ数、今日・今週の件数、未対応数
            </li>
            <li>
              <strong>対応状況バー</strong>: 未対応・対応中・対応済・対応不要の割合
            </li>
            <li>
              <strong>カテゴリ別分布</strong>: ドーナツチャートで10カテゴリの内訳を表示
            </li>
            <li>
              <strong>メッセージ推移</strong>: 直近30日の日別メッセージ数の折れ線グラフ
            </li>
          </ul>
        </Section>

        {/* 管理: ユーザー */}
        <Section id="admin-users" title="管理: ユーザー">
          <p className="text-sm mb-3">
            ダッシュボードにアクセスできるユーザーを管理します。ロール（管理者・HRスタッフ・閲覧者）を割り当てます。
          </p>
          <div className="flex items-center gap-2 mb-3">
            <RoleBadge label="管理者" />
          </div>
          <Screenshot
            src="/screenshots/help/08-admin-users.png"
            alt="ユーザー管理"
            caption="ユーザー管理 — ロールとステータスを一覧表示"
          />
          <StepList>
            <Step>「ユーザー追加」ボタンをクリックします</Step>
            <Step>メールアドレス、表示名、ロールを入力します</Step>
            <Step>追加されたユーザーは次回ログインからアクセス可能になります</Step>
          </StepList>
        </Section>

        {/* 管理: スペース */}
        <Section id="admin-spaces" title="管理: スペース">
          <p className="text-sm mb-3">
            Google Chat
            のチャット同期対象スペースを管理します。スペースを追加するには、対象スペースに管理者アカウントが参加している必要があります。
          </p>
          <div className="flex items-center gap-2 mb-3">
            <RoleBadge label="管理者" />
          </div>
          <Screenshot
            src="/screenshots/help/09-admin-spaces.png"
            alt="スペース管理"
            caption="スペース管理 — 同期対象スペースの一覧"
          />
        </Section>

        {/* 管理: 従業員 */}
        <Section id="admin-employees" title="管理: 従業員">
          <p className="text-sm mb-3">
            従業員マスタの一覧を表示します。社員番号、名前、雇用形態、部署、入社日などを確認できます。
          </p>
          <div className="flex items-center gap-2 mb-3">
            <RoleBadge label="管理者" />
          </div>
          <Screenshot
            src="/screenshots/help/11-admin-employees.png"
            alt="従業員一覧"
            caption="従業員一覧 — 全従業員のマスタ情報"
          />
        </Section>

        {/* 管理: 監査ログ */}
        <Section id="admin-audit-logs" title="管理: 監査ログ">
          <p className="text-sm mb-3">
            システム上の全操作を記録した監査ログを閲覧できます。ユーザーの追加・削除、ドラフトの承認など、重要な操作の履歴を確認できます。
          </p>
          <div className="flex items-center gap-2 mb-3">
            <RoleBadge label="管理者" />
          </div>
          <Screenshot
            src="/screenshots/help/12-admin-audit-logs.png"
            alt="監査ログ"
            caption="監査ログ — 管理者のみアクセス可能"
          />
          <Tip>
            監査ログは管理者ロールのみ閲覧可能です。閲覧権限がない場合はアクセス制限メッセージが表示されます。
          </Tip>
        </Section>

        {/* 管理: AI設定 */}
        <Section id="admin-ai-settings" title="管理: AI設定">
          <p className="text-sm mb-3">
            AI によるメッセージ分類の設定を調整します。正規表現ルール、LLM
            ルール、テスト分類、精度分析の4つのタブで管理します。
          </p>
          <div className="flex items-center gap-2 mb-3">
            <RoleBadge label="管理者" />
          </div>
          <Screenshot
            src="/screenshots/help/10-admin-ai-settings.png"
            alt="AI設定"
            caption="AI設定 — 10カテゴリの正規表現ルール一覧"
          />
          <h3 className="text-sm font-semibold mt-6 mb-2">タブ説明</h3>
          <ul className="list-disc list-inside text-sm space-y-1 ml-2">
            <li>
              <strong>正規表現ルール</strong>: カテゴリごとのキーワード・パターンを編集
            </li>
            <li>
              <strong>LLM ルール</strong>: AI 分類のシステムプロンプト・Few-shot 例を管理
            </li>
            <li>
              <strong>テスト</strong>: サンプルテキストで分類結果をテスト
            </li>
            <li>
              <strong>分類精度</strong>: 正解ラベルとの比較で分類精度を分析
            </li>
          </ul>
        </Section>

        {/* 権限一覧 */}
        <Section id="roles" title="権限一覧">
          <p className="text-sm mb-4">ユーザーのロールによってアクセスできる機能が異なります。</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-semibold">機能</th>
                  <th className="text-center py-2 px-3 font-semibold">
                    <RoleBadge label="管理者" />
                  </th>
                  <th className="text-center py-2 px-3 font-semibold">
                    <RoleBadge label="HRスタッフ" />
                  </th>
                  <th className="text-center py-2 px-3 font-semibold">
                    <RoleBadge label="閲覧者" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 pr-4">受信箱（閲覧・対応）</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">—</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">タスクボード</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">—</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">承認ワークフロー</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">—</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">ダッシュボード</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">○</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">ユーザー管理</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">—</td>
                  <td className="text-center py-2">—</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">スペース管理</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">—</td>
                  <td className="text-center py-2">—</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">従業員一覧</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">—</td>
                  <td className="text-center py-2">—</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">監査ログ</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">—</td>
                  <td className="text-center py-2">—</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">AI設定</td>
                  <td className="text-center py-2">○</td>
                  <td className="text-center py-2">—</td>
                  <td className="text-center py-2">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
