# HR-AI Agent — Session Handoff

**最終更新**: 2026-02-21（セッション終了時点）
**ブランチ**: `main`（最新コミット: `4e4ec4e` — 全変更 push 済み、未プッシュなし）

---

## 現在のフェーズ

**Phase 1 — 全コア実装完了 + Cloud Run IaC + CI/CD パイプライン整備（実装完了）**

Chat 収集・AI 分類・給与ドラフト・承認ダッシュボード・GCP インフラ（Worker デプロイ済み）・CI/CD パイプライン（GitHub Actions）が完成しています。
現在の最重要課題: **CI が GitHub Billing 問題で失敗中**（コードの問題ではなく、支払い制限）。

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
| Auth Fix | ログイン機能完全修正（dev-login + Google OAuth） | main (3d8c173) | 完了 |
| Logger | 構造化ロガー + auth ミドルウェア DRY 改善 | main (858cc58) | 完了 |
| UI Theme | Executive Slate × Amber テーマ全面適用 | main (36839d5) | 完了 |
| **#40** | **API + Web Cloud Run Dockerfile 追加** | **main (bcec4da)** | **完了** |
| **#41** | **本番 Firestore seed — CSV 998件投入** | **main (5374649)** | **完了** |
| **#42** | **Chat REST API バックフィル + チャット画面リッチ化** | **main (14caf8b)** | **完了** |
| **#37/#16** | **Pub/Sub メタデータ補完（Chat API enrichment）** | **main (4e4ec4e)** | **完了** |
| **#39** | **Cloud Run IaC（SA + IAM Terraform）** | **main (4e4ec4e)** | **完了** |
| **CI/CD** | **GitHub Actions（CI + Deploy to Cloud Run）** | **main (4e4ec4e)** | **完了（※Billing停止中）** |
| **Indexes** | **Firestore 複合インデックス追加（audit_logs/employees/chat_messages）** | **main (deaf84e)** | **完了** |
| **Token Refresh** | **Google ID トークン自動更新（1時間後の認証切れ解消）** | **main (6a2c6f5)** | **完了** |
| **Test** | **Firestore クエリ統合テスト基盤 + FE/BE 型契約テスト** | **main (4e4ec4e)** | **完了** |

---

## 直近の変更（本セッション — 最新）

### feat: Pub/Sub メタデータ補完 + Cloud Run IaC + CI/CD (4e4ec4e, PR #43)

**Phase A: Chat API enrichment (Closes #37, #16)**
- `apps/worker/src/lib/chat-api.ts` 新規作成（`@googleapis/chat` Client）
- `apps/worker/src/lib/enrich-event.ts`: `enrichChatEvent()` — formattedText/annotations/attachments を best-effort 補完（失敗時は元 event で続行）
- `process-message.ts`: Step 1.5 として `enrichChatEvent` 呼び出しを追加
- `enrich-event.test.ts` 新規追加（9 tests）

**Phase B: Cloud Run IaC (Closes #39)**
- `infra/cloud-run/main.tf` 新規作成（SA + IAM ロール + Workload Identity 定義）

**Phase C: Firestore クエリ統合テスト基盤**
- `apps/api/src/__tests__/firestore-queries.integration.test.ts`: 17 クエリパターンをエミュレータで検証
- `apps/web/src/__tests__/api-contract.test.ts`: FE/BE 型整合性の契約テスト（5 checks）
- `apps/api/vitest.config.ts` / `vitest.integration.config.ts`: 単体/統合テスト設定分離
- `turbo.json` / `package.json`: `test:integration` タスク追加

**Phase D: GitHub Actions CI/CD**
- `.github/workflows/ci.yml`: PR 時に Lint + Typecheck + Test
- `.github/workflows/deploy.yml`: main push 時に変更検知 → API/Web/Worker を選択的デプロイ

### fix(db): Firestore 複合インデックス追加 (deaf84e)
- `firestore.indexes.json`: chat_messages に `threadName/spaceId/messageType` 複合インデックス追加

### fix(web): Dockerfile から next-env.d.ts の COPY を削除 (4daf3c4)

### fix(web): Google ID トークン自動更新 (6a2c6f5)
- `apps/web/src/auth.ts`: `refresh_token` で `access_token` を自動更新（1時間後の認証切れを解消）

### feat(infra): API + Web Cloud Run Dockerfile 追加 (bcec4da, PR #40)
- `apps/api/Dockerfile` / `apps/web/Dockerfile` 作成（Multi-stage build）

### feat(db): 本番 Firestore seed — CSVから998件投入 (5374649, PR #41)
- `packages/db/scripts/seed-from-csv.ts`: CSV → Firestore bulk 投入スクリプト

### feat: Chat REST API バックフィル + チャット画面リッチ化 (14caf8b, PR #42)
- `apps/worker/src/lib/event-parser.ts`: Chat API バックフィル対応（`backfill` フラグ）
- Web: チャット詳細画面のスレッド可視化強化

---

## 緊急対応が必要な問題

### CI 失敗（Billing 停止）

```
X The job was not started because recent account payments have failed or
  your spending limit needs to be increased.
  Check the 'Billing & plans' section in your settings
```

- GitHub Actions の `Deploy to Cloud Run` ワークフローが Billing 制限で停止中
- コードの問題ではない
- **対応**: GitHub のアカウント設定 > Billing & plans で支払い方法・上限を確認

---

## 次のアクション候補

1. **[緊急] GitHub Billing 修正** — Actions が停止中。課金設定を確認
2. **Cloud Run 本番デプロイ（API + Web）**
   - Workload Identity Federation の設定（`infra/cloud-run/main.tf` 参照）
   - GitHub Secrets に `WIF_PROVIDER` / `WIF_SERVICE_ACCOUNT` を設定
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `API_BASE_URL` を Cloud Run シークレットへ
3. **Google OAuth 本番 Redirect URI 設定**
   - GCP Console > APIs & Services > Credentials で `https://[hr-web URL]/api/auth/callback/google` を追加
4. **Phase 2 スキーマ最適化**
   - `ChatMessage` に `intentCategory` を非正規化（カテゴリフィルタのページネーション精度向上）
   - SmartHR / Google Sheets / Gmail 連携実装
5. **Issue #15**: スレッドコンテキストを使った分類精度向上（P1）
6. **Issue #18**: 正規表現ルール管理 UI（P2）
7. **Issue #38**: LLM 分類ルール管理 UI — Few-shot 例・システムプロンプトの動的追加（P2）

---

## デプロイ環境

| サービス | 状態 | URL/識別子 |
|---------|------|-----------|
| Cloud Run (Worker) | デプロイ済み | `hr-worker` (asia-northeast1) |
| Cloud Run (API) | Dockerfile 作成済み、未デプロイ | `hr-api` (次フェーズ) |
| Cloud Run (Web) | Dockerfile 作成済み、未デプロイ | `hr-web` (次フェーズ) |
| Artifact Registry | 作成済み | `asia-northeast1-docker.pkg.dev/hr-system-487809/hr-system` |
| Firestore | 本番稼働中 | Native モード (asia-northeast1) — 1000件超のシードデータ投入済み |
| Pub/Sub | 稼働中 | `hr-chat-events` + `hr-chat-events-dlq` |
| GitHub Actions CI | Billing 問題で停止中 | `.github/workflows/ci.yml` / `deploy.yml` |

---

## テスト状況

| パッケージ/アプリ | テストファイル | テスト数 |
|-----------------|--------------|---------|
| packages/salary | calculator.test.ts | 境界値テスト含む |
| packages/shared | approval.test.ts + status-transitions.test.ts | |
| apps/api | auth.test.ts + health.test.ts + salary-drafts.test.ts | 22 |
| apps/api (integration) | firestore-queries.integration.test.ts | 17 |
| apps/worker | event-parser.test.ts + dedup.test.ts + process-message.test.ts + salary-handler.test.ts + enrich-event.test.ts | 41 |
| apps/web | smoke.test.ts + api-contract.test.ts | 6 |

---

## オープン GitHub Issues

| # | タイトル | ラベル |
|---|---------|--------|
| #15 | スレッドコンテキストを使った分類精度向上 | P1, enhancement, ai |
| #17 | 分類フィードバック学習ループ | P2, enhancement, ai |
| #18 | 正規表現ルール管理 UI | P2, enhancement |
| #19 | 分類分析ダッシュボード強化 | P3, enhancement |
| #38 | LLM 分類ルール管理 UI（Few-shot 例・システムプロンプト動的追加） | P2, enhancement, ai |

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
