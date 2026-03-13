# HR-AI Agent — Session Handoff

**最終更新**: 2026-03-13（セッション終了時点・最終更新）
**ブランチ**: `main`（最新コミット: `7b72d6d` — fix: intent_records に category+createdAt 複合インデックス追加）

---

## 現在のフェーズ

**Phase 9 — タスク管理拡張**

担当者・期限のインライン編集、コンボ入力、キーボードナビ、カレンダーピッカーを順次追加。手動タスク作成フォームを Dialog モーダル化して UI 改善（PR #268）。受信箱/タスクボードの AI判定パネルを削除（PR #267）。

**CI**: Deploy to Cloud Run (7b72d6d) — **failure**（Firestore インデックスデプロイで 403 エラー）

---

## MVP 実装状況

詳細な変更履歴は `docs/handoff/archive/2026-03-history.md` を参照。

| フェーズ | 内容 | 状態 |
|---------|------|------|
| Phase 1〜5 | コア基盤（給与計算・Chat連携・LINE連携・認証・CI/CD） | 完了 |
| Phase 6 | Inbox（受信箱）+ ワークフロー管理 | 完了 |
| Phase 7 | UI再設計（3ペイン Inbox・タスクサイドパネル・Admin 統合） | 完了 |
| Phase 8 | タスク優先度・手動タスク・セキュリティ強化・パフォーマンス改善 | 完了 |
| Phase 9 | 担当者・期限インライン編集・手動タスクUI改善・AI判定パネル削除 | 完了 |
| Phase 10 | タスクテーブルビュー拡充（列分離・カテゴリタグ/フィルタ・ワークフローステップ列・メモ列） | 完了 |

---

## 直近の変更（最新5件）

### fix: intent_records に category+createdAt 複合インデックス追加 (7b72d6d)
- intent_records コレクションに category + createdAt の複合インデックスを追加
- CI: Deploy to Cloud Run — **failure**（後述の要対応事項を参照）

### fix: ワークフローステップUIの視認性・操作性を改善 (#294) (#297) (cfedb19)
- ワークフローステップUIの視認性・操作性を改善
- CI: Deploy to Cloud Run — success

### feat: LINEメッセージにカテゴリフィルター追加 (#292) (#296) (c22c4cc)
- LINEメッセージ一覧にカテゴリフィルターを追加
- CI: Deploy to Cloud Run — failure（IAM 権限 403）

### feat: 受信箱カテゴリフィルター追加 & 手入力タスクにカテゴリ選択追加 (#290, #291) (#295) (25e7d51)
- 受信箱へカテゴリフィルターを追加、手入力タスクにカテゴリ選択機能を追加
- CI: Deploy to Cloud Run — success

### feat: LINE・手入力タスクにワークフローステップとメモを追加 (#289) (713dcc1)
- LINE メッセージ由来タスクと手入力タスクにもワークフローステップとメモ機能を追加（Chat由来タスクとの機能統一）
- CI: Deploy to Cloud Run — success

### feat: タスクボードにワークフローステップ列とメモ列を追加 (#279) (#282) (e269d4c)
- タスクボードのテーブルビューにワークフローステップ列とメモ列を追加
- CI: Deploy to Cloud Run — success

### feat: タスクボードにAIカテゴリタグ表示とカテゴリフィルタを追加 (#278) (#281) (5a3f0d6)
- AIカテゴリタグをテーブルに表示し、カテゴリフィルタを追加
- CI: Deploy to Cloud Run — success

### feat: タスクテーブル列を記事のコピー・チャットURL・タスクに分離 (#280) (02dc4b8)
- タスクテーブルの列構成を整理・分離
- CI: Deploy to Cloud Run — success

### fix: デッドコード task-detail-panel.tsx を削除し、テストを新テーブルビューに整合 (#276) (e0d21e5)
- デッドコードになっていた `task-detail-panel.tsx` を削除
- テストを新しいテーブルビューに整合させて修正
- CI: Deploy to Cloud Run — success

### feat: タスク一覧をカード型リストからテーブルビュー（スプレッドシート風）に変更 (#274) (#275) (b684e50)
- タスク一覧UIをカード型からスプレッドシート風テーブルビューに全面変更
- CI: Deploy to Cloud Run — success

### fix: タスク一覧の優先度付きメッセージ表示漏れを修正 (#273) (5dd2a22)
- タスク一覧で優先度付きメッセージが表示されない問題を修正
- CI: Deploy to Cloud Run — success

### fix: 手動タスク作成後のタスク自動選択を Context 経由に変更 (#272) (d4dd9b2)
- タスク自動選択ロジックを props 経由から Context 経由に変更（クライアント側エラー修正の後続対応）
- CI: Deploy to Cloud Run — success

### fix: 手動タスク削除時のクライアントエラーを修正 (#271) (e2bb775)
- 手動タスク削除時に発生していたクライアントエラーを修正
- CI: Deploy to Cloud Run — success

### feat: 手動タスク作成後に作成タスクを自動選択して詳細パネル表示 (#269) (#270) (0196cc2)
- 手動タスク作成後、作成したタスクを自動選択して詳細パネルに表示
- CI: Deploy to Cloud Run — success

### chore: PR #134 で移動済みの旧 ai-settings/page.tsx を削除 (b7c3ead)
- `apps/web/src/app/(protected)/ai-settings/page.tsx` を `git rm` で削除（残留ファイルのクリーンアップ）
- CI: Deploy to Cloud Run — success（Web のみ再デプロイ）

### feat: 手動タスク作成フォームをDialogモーダル化 + UI改善 (#268) (6f09f42)
- 手動タスク作成フォームを独立ページからDialogモーダルに変更
- CI: Deploy to Cloud Run — success

### refactor: 受信箱/タスクボードの AI判定パネルを削除 (#267) (b07f6b4)
- 受信箱(Inbox)およびタスクボードの右ペイン AI判定パネルを削除
- CI: Deploy to Cloud Run — success

### fix: DialogContent の aria-describedby 警告を修正 (#266) (a0a2628)
- shadcn/ui DialogContent に description が欠落している場合の aria-describedby 警告を修正

### feat: ユーザー管理の操作メニューに「表示名を編集」を追加 (#265) (39bb47c)
- ユーザー管理テーブルの操作メニューに「表示名を編集」アクションを追加

### fix: 担当者フィールドのIME候補選択で苗字のみ入力される問題を修正 (#264) (67675dc)
- IME変換候補をクリックまたはEnterで確定した際、苗字のみが入力欄に残る問題を修正

---

## 次のアクション候補

1. **CI 修正（P1 ブロッカー）**: Firestore インデックスデプロイ用の GHA SA に `roles/serviceusage.serviceUsageConsumer` 権限を付与（IAM 403 エラー）
2. **SmartHR / Google Sheets / Gmail 連携実装**（Phase 2 後半）
3. **E2E テスト自動化**（Playwright による本番フロー検証）
4. **Node.js 20 Actions 非推奨対応**（GitHub Actions を Node.js 24 対応バージョンへ更新。期限: 2026-06-02）

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
| apps/api (integration) | auth-authz.integration.test.ts | 追加済み |
| apps/worker | event-parser.test.ts + dedup.test.ts + process-message.test.ts + salary-handler.test.ts + enrich-event.test.ts + worker.integration.test.ts | 41+ |
| apps/web | smoke.test.ts + api-contract.test.ts + inbox-3pane.test.tsx + sidebar-nav.test.tsx + help.test.tsx 等 | 92+ |
| **合計** | | **297+（統合テスト追加後）** |

---

## オープン GitHub Issues

現在オープンな Issue なし（全 Issue がクローズ済み）。

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
