# HR-AI Agent — Session Handoff

**最終更新**: 2026-03-07（セッション終了時点・最終更新）
**ブランチ**: `main`（最新コミット: `e1cc36e` — 全変更 push 済み、未プッシュなし）

---

## 現在のフェーズ

**Phase 4 — Web UI 3ペイン Inbox + タスクサイドパネル + Admin 統合完了**

FE-BE 型アライメント（PR #130）、UI 再設計として 3ペイン Inbox・Tasks サイドパネル・Admin 5タブ統合・定数集約（PR #134）を実施。
CI (Deploy to Cloud Run) は PR #130（`894312e`）まで成功・デプロイ完了。PR #134（`e1cc36e`）の Deploy は 2026-03-07 10:02 時点で in_progress（CI は success）。
**積み残しタスクなし。**

---

## MVP 実装状況

| タスク | 内容 | コミット/PR | 状態 |
|--------|------|------------|------|
| Task B〜H | マスターデータ・給与計算・承認SM・Gemini分類・OAuth/RBAC | main (#5〜#9) | 完了 |
| Task I/J | REST API（salary-drafts / employees / audit-logs） | main (#10) | 完了 |
| Task K | Next.js 承認ダッシュボード（Auth.js + shadcn/ui） | main (#11) | 完了 |
| Task L | Chat Webhook Worker（Pub/Sub + OIDC） | main (#12) | 完了 |
| Task M | チャットデータ収集・ハイブリッド分類基盤 | main (#13) | 完了 |
| Task N | GCP インフラ（Cloud Run Worker + Pub/Sub + Artifact Registry） | main (#20) | 完了 |
| Wave 1〜5 | チャット分析ダッシュボード（統計・ルール管理・対応状況） | main (#35) | 完了 |
| CI/CD | GitHub Actions（CI + Deploy to Cloud Run）WIF認証済み | main (#46〜#53) | 完了 |
| #17 | 分類フィードバック学習ループ（精度可視化・手動修正分析・CSVエクスポート） | main (#54) | 完了 |
| #19 | ダッシュボード強化（要確認フィルタ・カテゴリ分布グラフ） | main (#55) | 完了 |
| #56/#57/#58 | チャットメンション表示修正（`<users/ID>` 形式対応） | main (#59) | 完了 |
| **#60/#61** | **チャットパイプラインのメタデータ欠損バグ修正** | **main (#62)** | **完了** |
| **#64** | **チャット分析ページ カードフィードUI刷新** | **main (#65)** | **完了** |
| **#66/#67（部分）** | **メンション表示バグ修正 & 空senderName対応** | **main (#68)** | **完了** |
| **#63** | **backfill-chat.ts に --repair フラグ追加 — 欠損 senderName 補完** | **main (#69)** | **完了** |
| **#71** | **Worker: メンション displayName が空の場合 spaces.members.get で補完** | **main (#72)** | **完了** |
| **#75** | **DB: repairChatMessages で mentionedUsers の displayName を spaces.members.get で補完** | **main (#76)** | **完了** |
| **#70** | **fix(web): メンションの数字IDを非表示 — 名前不明時は「不明ユーザー」を表示** | **main (#77)** | **完了** |
| **#73** | **feat(web): チャットカードに添付ファイルを展開表示** | **main (#78)** | **完了** |
| **#74** | **feat(web): チャットカードに Google Chat メッセージへの遷移リンクを追加** | **main (#79)** | **完了** |
| **#67** | **style(web): カードUI品質改善 — shadow・アバター・フォント・レイアウト調整** | **main (#80)** | **完了** |
| **—** | **fix(web): MessageCard を Client Component に分離 — Server Component で onClick 不可問題修正** | **main (#81)** | **完了** |
| **—** | **fix(web): formatDateTime に timeZone: Asia/Tokyo を追加し Hydration mismatch を修正** | **main (#82)** | **完了** |
| **—** | **fix(web): 添付ファイルのリンク先を Google Chat メッセージに変更** | **main (#83)** | **完了** |
| **—** | **fix(web): 添付ファイルのリンクを Google Chat ファイル名検索 URL に変更** | **main (#84)** | **完了** |
| **—** | **fix(web): 添付ファイルリンクのクリック伝播を停止 & テスト追加** | **main (#85)** | **完了** |
| **—** | **fix(web): `<Link>` を `<button>+useRouter` に変更し添付ファイルリンクを修正** | **main (#86)** | **完了** |
| **—** | **fix(web): 添付ファイルリンクを新しいウィンドウで開くよう変更** | **main (#87)** | **完了** |
| **—** | **fix(web): Google Chat リンクを新しいウィンドウで開き Chrome タブインターセプトを回避** | **main (#88)** | **完了** |
| **—** | **fix(web): Google Chat リンクを #search/ URL に変更しメッセージへ直接遷移** | **main (#89)** | **完了** |
| **—** | **fix(worker): senderName/@メンション表示名が空になる問題を修正** | **main (#90)** | **完了** |
| **—** | **fix(web): audit-logs ページの 403 エラーでクラッシュする問題を修正** | **main (#91)** | **完了** |
| **—** | **fix(web): パイチャートのラベル重なりを Legend 表示に変更** | **main (#92)** | **完了** |
| **—** | **fix(web): パイチャートのツールチップにカテゴリ名と割合を表示** | **main (#93)** | **完了** |
| **—** | **feat(web): カテゴリ別分布をドーナツ＋横棒グラフ切替タブに変更** | **main (#94)** | **完了** |
| **—** | **fix(api): Chat同期 403エラーを修正（ADC 開発者 OAuth クレデンシャル利用）** | **main (#95)** | **完了** |
| **—** | **feat(web): カテゴリ別分布を2カラムレイアウトに刷新（空間効率改善）** | **main (#98)** | **完了** |
| **—** | **fix(web): モバイルナビ overflow 修正＋カテゴリチャートクリック連動** | **main (#99)** | **完了** |
| **—** | **fix(web): チャート外クリック解除・グレーアウト緩和** | **main (#100)** | **完了** |
| **—** | **feat(chat-sync): 定期同期 + 設定変更 UI を追加（Cloud Scheduler + 歯車アイコンパネル）** | **main (#101)** | **完了** |
| **—** | **fix(db): backfill-chat repair に Firestore transient エラーリトライを追加** | **main** | **完了** |
| **—** | **feat(web): 「作成案」ワークフロー管理テーブルビューを追加（インライン編集・手順クリックサイクル）** | **main (#102)** | **完了** |
| **—** | **fix(web): intent=null のメッセージもテーブルビューで編集可能にする** | **main (#103)** | **完了** |
| **—** | **perf(web): ビュー切替をクライアント側 useState に変更 — ページ遷移なしで即時切替** | **main (#104)** | **完了** |
| **—** | **feat(web): チャット分析・ダッシュボードに60秒自動リフレッシュを追加（バックグラウンドタブはスキップ）** | **main (#105)** | **完了** |
| **—** | **feat: チャットスペース管理機能を追加（スペース追加・削除・一覧、管理タブ）** | **main (#106)** | **完了** |
| **—** | **fix(web): /admin/spaces に「詳しく見る」展開セクションを追加** | **main (49cab10)** | **完了** |
| **—** | **fix(dashboard): スペース別メッセージ数に表示名を反映** | **main (1d0a8a6)** | **完了** |
| **—** | **fix(web): AutoRefresh をマウント直後に即時リフレッシュするよう修正** | **main (37248f5)** | **完了** |
| **#108〜#112** | **feat: LINE グループチャット収集・表示機能（Webhook・Firestore・API・Web タブ切替）** | **main (d259470, PR #113)** | **完了** |
| **—** | **fix(api): line-messages/stats ルーティング修正 — 重複マウントを削除** | **main (53a79a2)** | **完了** |
| **—** | **fix(web): toLocaleString による hydration mismatch を修正 (#115)** | **main (7acf646)** | **完了** |
| **—** | **fix(web): LINE メッセージカードの line-clamp-3 を除去して全文表示 (#118)** | **main (dc3e594)** | **完了** |
| **—** | **feat: LINE 画像メッセージの取得・Cloud Storage 保存・表示対応 (#119)** | **main (0b36c27)** | **完了** |
| **—** | **fix(worker): GCS Uniform Bucket-Level Access との互換性修正 + バックフィルスクリプト追加 (#120)** | **main (d68bbfb)** | **完了** |
| **—** | **feat(web): レイアウト刷新 — 縦サイドバー + ヘッダーリデザイン (#122)** | **main (e2fe103)** | **完了** |
| **—** | **feat: Inbox（受信箱）+ ワークフロー管理 — Phase 2 (#124)** | **main (4b3425d)** | **完了** |
| **—** | **test: Phase 2 Inbox テスト追加 — responseStatus フィルタ + inbox-counts + isNavActive (#125)** | **main (7fd75c0)** | **完了** |
| **—** | **feat(web): Phase 3 — ダッシュボード刷新 + 引き継ぎメモ + AI提案パネル (#126)** | **main (1582776)** | **完了** |
| **—** | **test(web): AiPanel ロジックテスト追加 — getConfidenceLabel 境界値 + CATEGORY_ACTIONS 網羅 (#127)** | **main (6235c62)** | **完了** |
| **—** | **feat(web): Phase 4 — Admin 設定ページのデザインリフレッシュ (#128)** | **main (2723571)** | **完了** |
| **—** | **feat(web): Phase 5 — チャット分析ページのデザイントークン統一 + 類似メッセージ表示 (#129)** | **main (9f23cda)** | **完了** |
| **—** | **fix(web): FE-BE 型アライメント — nullable 修正 + DraftItem 構造統一 + 契約テスト強化 (#130)** | **main (894312e)** | **完了** |
| **—** | **feat(web): UI再設計 — 3ペイン Inbox + タスクサイドパネル + Admin 統合 (#134)** | **main (e1cc36e)** | **完了** |

---

## 直近の変更（最新5件）

### feat(web): UI再設計 — 3ペイン Inbox + タスクサイドパネル + Admin 統合 (e1cc36e, PR #134)
- Inbox: 左(320px一覧)+中央(詳細)+右(300px AI判定)の3ペイン構成、HandoverForm 統合
- Tasks: ドラフト詳細サイドパネル（金額比較/AI分析/承認履歴）、テーブル行クリックで展開
- Admin: 5タブ統合（ユーザー/スペース/従業員/監査ログ/AI設定）、旧 URL からリダイレクト
- 定数・ユーティリティを `@/lib/constants` に集約（6ファイルのローカル定義削除）
- ナビ 8項目→4項目、`/` → `/inbox` リダイレクト、`/tasks` ページ追加

### fix(web): FE-BE 型アライメント — nullable 修正 + DraftItem 構造統一 + 契約テスト強化 (894312e, PR #130)
- types.ts: reason/appliedRules/email 等 nullable 修正、DraftItem を BE 構造に統一
- EmployeeDetail インターフェース追加（currentSalary 含む）
- UI: null 安全なフォールバック表示（drafts/employees/audit-logs）
- 契約テスト 19 件（nullable/EmployeeDetail/eventType/entityType 修正）

### feat(web): Phase 5 — チャット分析ページのデザイントークン統一 + 類似メッセージ表示 (9f23cda, PR #129)
- 全 `slate-*` ハードコードカラーをデザイントークンに置換
- LINE/GChat の Pagination コンポーネントを共通化
- メッセージ詳細ページに同カテゴリの類似メッセージセクションを追加

### feat(web): Phase 4 — Admin 設定ページのデザインリフレッシュ (2723571, PR #128)
- admin-tabs: アイコン付きピル型タブに刷新
- users/spaces テーブルカードを `rounded-xl border-border/60` に統一

### feat(web): Phase 3 — ダッシュボード刷新 + 引き継ぎメモ + AI提案パネル (1582776, PR #126)
- ダッシュボード: SummaryCard、InboxStatusBar、2カラムレイアウト
- Inbox 展開パネルに HandoverForm 追加
- チャット詳細ページに AiPanel 追加（AI信頼度バー、判断理由、10カテゴリ別推奨アクション）

---

## 次のアクション候補

**積み残しタスクはゼロです。**

1. **PR #134 CI 完了確認**: `gh run list --limit 3` で Deploy to Cloud Run の成功を確認（2026-03-07 10:02 時点 in_progress）
2. **未追跡ファイル削除**: `layout-refresh-login.png` / `layout-refresh-login-fixed.png` — ルートに残っているスクリーンショット。不要なら削除
3. **LINE Webhook 本番設定**
   - LINE Developers Console で Webhook URL を Cloud Run Worker の `/line/webhook` に設定
   - `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` を Cloud Run Worker の Secret に追加
   - GCS バケット `hr-system-487809-line-media` の allUsers 公開ポリシー設定（画像表示に必要）
   - 既存メディアメッセージのバックフィル: `apps/worker/src/scripts/backfill-line-media.ts`
4. **Cloud Run 本番シークレット設定**（未設定の場合）
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `API_BASE_URL`
5. **Google OAuth 本番 Redirect URI 設定**
   - GCP Console > APIs & Services > Credentials
6. **SmartHR / Google Sheets / Gmail 連携実装**（Phase 2 後半）
7. **未追跡ファイル**: `packages/db/src/check-rawpayload.ts` — デバッグ用スクリプト。不要なら削除、必要なら `.gitignore` 対象に追加

### 完了済みバックログ（参考）

| Issue | 内容 | 結果 |
|-------|------|------|
| **#96** | senderName・メンション表示名が空になる問題の根本解決 | 調査完了。459件のうち199件は `users/unknown`（修復不可）、260件は退職済みアカウント（People API 404 — 技術的に修復不可）。Issue に調査結果コメント記録済み |
| **#97** | 不要 IAM バインディング（hr-api → hr-worker serviceAccountTokenCreator）削除 | 削除済みを `gcloud iam` コマンドで確認済み |

---

## デプロイ環境

| サービス | 状態 | URL/識別子 |
|---------|------|-----------|
| Cloud Run (Worker) | デプロイ済み | `hr-worker` (asia-northeast1) |
| Cloud Run (API) | デプロイ済み | `hr-api` (asia-northeast1) |
| Cloud Run (Web) | デプロイ済み | `hr-web` (asia-northeast1) |
| Artifact Registry | 作成済み | `asia-northeast1-docker.pkg.dev/hr-system-487809/hr-system` |
| Firestore | 本番稼働中 | Native モード (asia-northeast1) |
| Pub/Sub | 稼働中 | `hr-chat-events` + `hr-chat-events-dlq` |
| GitHub Actions | CI完了・Deploy完了 | `.github/workflows/deploy.yml` |

---

## テスト状況

| パッケージ/アプリ | テストファイル | テスト数 |
|-----------------|--------------|---------|
| packages/salary | calculator.test.ts | 境界値テスト含む |
| packages/shared | approval.test.ts + status-transitions.test.ts | |
| apps/api | auth.test.ts + health.test.ts + salary-drafts.test.ts + intent-stats.test.ts | 22+ |
| apps/api (integration) | firestore-queries.integration.test.ts | 17 |
| apps/worker | event-parser.test.ts + dedup.test.ts + process-message.test.ts + salary-handler.test.ts + enrich-event.test.ts | 41 |
| apps/web | smoke.test.ts + api-contract.test.ts + inbox-3pane.test.tsx + sidebar-nav.test.tsx + draft-side-panel.test.tsx 等 | 72+ |

---

## オープン GitHub Issues

**なし — 積み残しタスクはゼロです。**

（#96/#97 は調査・対応完了。詳細は「次のアクション候補」の完了済みバックログを参照）

---

## アーキテクチャ概要

```
apps/
  api/          Hono (TypeScript) — Cloud Run API サーバー (port 3001)
  worker/       Hono (TypeScript) — Chat Webhook Worker (port 3002)
  web/          Next.js 15 App Router — 承認ダッシュボード (port 3000)
packages/
  db/           Firestore 型定義・コレクション・クライアント
  shared/       DraftStatus, ApprovalAction, validateTransition 等
  salary/       確定的給与計算エンジン（LLM不使用）
  ai/           Gemini intent分類（正規表現プレ分類レイヤー付き）
infra/
  cloud-run/    Terraform（SA + IAM + Workload Identity）
  oauth/        Terraform（Google OAuth クライアント）
.github/
  workflows/    CI（PR時）+ Deploy to Cloud Run（main push時）
```

---

## ステータス遷移（ADR-006 準拠）

```
draft → reviewed → approved → processing → completed
          ↓           ↓
       rejected    rejected
裁量的変更: reviewed → pending_ceo_approval → approved
```

行き止まりなし（rejected は再ドラフト可能な設計）

---

## 再開手順

```bash
cd /Users/yyyhhh/ACG/hr-system

# 開発サーバー起動（API: 3001, Web: 3000, Worker: 3002）
pnpm dev

# Firebase Emulator（別ターミナル）
pnpm emulator

# テスト実行
pnpm test

# 統合テスト（Firestore Emulator が起動している状態で）
pnpm --filter @hr-system/api test:integration
```
