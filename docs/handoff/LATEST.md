# HR-AI Agent — Session Handoff

**最終更新**: 2026-02-24（セッション終了時点）
**ブランチ**: `main`（最新コミット: `9d621c6` — 全変更 push 済み、未プッシュなし）

---

## 現在のフェーズ

**Phase 2 — ビュー切替 クライアントサイド useState 最適化完了 (PR #104 マージ済み)**

「作成案」テーブルビュー（インライン編集・ワークフロー手順クリックサイクル）、Chat定期同期設定UI（Cloud Scheduler + 歯車アイコンパネル）、intent=null メッセージのテーブル編集対応、ビュー切替のクライアント側 useState 化（ページ遷移なし即時切替）を実施。
CI (Deploy to Cloud Run) は #104 マージ後に成功・デプロイ完了。
オープン Issue: なし（#96/#97 はバックログ）。

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

---

## 直近の変更（最新5件）

### perf(web): ビュー切替をクライアント側 useState に変更 (9d621c6, PR #104)
- カード/テーブル切替タブを URL クエリパラメータではなく useState で管理
- ページ遷移なしで即時切替が可能に（UX改善）

### fix(web): intent=null のメッセージもテーブルビューで編集可能にする (5b20636, PR #103)
- PATCH /response-status: IntentRecord がない場合に 404 ではなく自動作成するよう修正
- table-view.tsx: !intent ガードをすべて削除（disabled/早期return/三項演算子）

### feat(web): 「作成案」ワークフロー管理テーブルビューを追加 (764e9fb, PR #102)
- packages/shared: WorkflowStepStatus / WorkflowSteps 型を追加
- packages/db: IntentRecord に taskSummary / assignees / notes / workflowSteps フィールドを追加
- apps/api: PATCH /chat-messages/:id/workflow エンドポイントを新規追加
- apps/web: スプレッドシート風インライン編集テーブルビューを追加（カード/テーブル切替タブ）

### fix(db): backfill-chat repair に Firestore transient エラーリトライを追加 (8417cf8)
- DEADLINE_EXCEEDED / UNAVAILABLE 発生時に指数バックオフ（1s→2s→4s）で最大3回リトライ

### feat(chat-sync): 定期同期 + 設定変更 UI を追加 (07f9ee8, PR #101)
- Cloud Scheduler API 有効化、chat-sync-job ジョブ作成（*/5 * * * * Asia/Tokyo）
- API: GET/PATCH /api/chat-messages/sync/config エンドポイント追加
- Web: 歯車アイコンから同期間隔・有効/無効を設定するパネルを追加

### fix(lint): import順序・noNonNullAssertion・noUselessConstructorを修正 (6caf10e)
- Biome lint エラー（import 順序、non-null assertion、useless constructor）を一括修正

---

## 次のアクション候補

1. **[P1] Issue #96 対応**: `chat.memberships.readonly` スコープの管理者承認待ち
   - 承認後 `gcloud auth login --scopes=...` で再認証し senderName 根本解決を実施
   - 対象: 既存メッセージ全5,573件 + 新規メッセージの displayName 補完
2. **[P2] Issue #97 対応**: 不要 IAM バインディング（hr-api → hr-worker serviceAccountTokenCreator）を削除
   - `gcloud iam service-accounts remove-iam-policy-binding ...` を実行
3. **Cloud Run 本番シークレット設定**（必要な場合）
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `API_BASE_URL`
4. **Google OAuth 本番 Redirect URI 設定**
   - GCP Console > APIs & Services > Credentials
5. **SmartHR / Google Sheets / Gmail 連携実装**（Phase 2 後半）
6. **未追跡ファイル**: `packages/db/src/check-rawpayload.ts` — デバッグ用スクリプト。不要なら削除、必要なら `.gitignore` 対象に追加

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
| apps/web | smoke.test.ts + api-contract.test.ts | 6 |

---

## オープン GitHub Issues

| # | タイトル | ラベル | 優先度 |
|---|---------|--------|--------|
| #96 | fix: senderName・メンション表示名が空になる問題を根本解決（chat.memberships.readonly スコープ取得） | enhancement | P1 |
| #97 | chore: 不要になった IAM バインディングの削除（hr-api → hr-worker serviceAccountTokenCreator） | — | P2 |

（gh issue list 実行結果: オープン Issue 0件 — #96/#97 はバックログとして残存するが gh 上はクローズ済みまたは確認不可）

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
