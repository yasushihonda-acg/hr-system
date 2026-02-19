# HR-AI Agent — Session Handoff

**最終更新**: 2026-02-20（セッション終了時点）
**ブランチ**: `main`（チャット分析ダッシュボード PR #35 マージ済み）

---

## 現在のフェーズ

**Phase 1 — コアバックエンド + 承認ダッシュボード + Chat Webhook Worker + チャット分析基盤 + GCP インフラ整備 + チャット分析ダッシュボード（実装完了）**

チャットデータの完全収集・AI/正規表現ハイブリッド分類・可視化・手動再分類・対応状況トラッキング・統計ダッシュボード・AI分類ルール管理・管理者ユーザー管理が実装完了しました。

---

## MVP 実装状況

| タスク | 内容 | ブランチ/コミット | 状態 |
|--------|------|------------------|------|
| Task B | マスターデータシードスクリプト | main (#7) | 完了 |
| Task C | 確定的給与計算エンジン | main (#9) | 完了 |
| Task D | 承認ステートマシン | main (#8) | 完了 |
| Task F | Gemini Intent 分類パッケージ | main (#5) | 完了 |
| Task H | Google OAuth + RBAC ミドルウェア (API) | main (#6) | 完了 |
| Task I/J | REST API エンドポイント (salary-drafts / employees / audit-logs) | main (#10) | 完了 |
| Task K | Next.js 承認ダッシュボード (Auth.js + shadcn/ui) | main (#11) | 完了 |
| Task L | Chat Webhook Worker | main (#12) | 完了 |
| Task M | チャットデータ収集・分析基盤 | main (#13) | 完了 |
| Task N | GCP インフラ整備 (Dockerfile / Cloud Run / Pub/Sub / Chat App) | main (#20) | 完了 |
| **Wave 1〜5** | **チャット分析ダッシュボード（認証・統計・ルール管理・対応状況）** | **main (#35)** | **完了** |

---

## 直近の変更（Wave 1〜5 — チャット分析ダッシュボード — 最新）

### チャット分析ダッシュボード完全実装

PR #35 にてマージ済み（main `1e5bcee`）。Issue #21, #29, #30, #32, #33, #34 をクローズ。

#### Wave 1: 認証・アクセス制御強化

- `apps/api/src/middleware/auth.ts`: Firestore `allowedUsers` コレクションをホワイトリストとして JWT 認証に追加（`isActive: true` のみ許可）
- `apps/api/src/routes/admin-users.ts`: 管理者ユーザー CRUD 4エンドポイント追加
  - `GET /api/admin/users` / `POST /api/admin/users` / `PATCH /api/admin/users/:id` / `DELETE /api/admin/users/:id`
- `apps/web/src/app/(protected)/admin/users/`: 管理画面（一覧・追加・編集・削除）

#### Wave 2: 統計ダッシュボード

- `apps/api/src/routes/stats.ts`: 統計 API 4エンドポイント
  - `GET /api/stats/summary` (total/today/week/month)
  - `GET /api/stats/categories` (10カテゴリ別件数・割合)
  - `GET /api/stats/timeline` (日別/週別/月別トレンド)
  - `GET /api/stats/spaces` (スペース別集計)
- `apps/web/src/app/(protected)/`: トップダッシュボード (`/`) に統計サマリー・カテゴリ分布・タイムラインチャート（Recharts）実装

#### Wave 3: AI分類ルール管理

- `apps/api/src/routes/classification-rules.ts`: ルール管理 API
  - `GET /api/classification-rules` / `PATCH /api/classification-rules/:category`
- `packages/db`: `classificationRules` コレクション定義追加（`ClassificationRule` 型）
- `apps/web/src/app/(protected)/classification-rules/`: AI分類ルール管理画面
  - カテゴリ別キーワード・除外キーワード・パターン・優先度・サンプルメッセージ編集

#### Wave 4: チャットメッセージ一覧・詳細強化

- チャットメッセージ一覧ページに対応状況フィルタ・スレッド件数表示を追加
- 詳細ページにスレッドビジュアライゼーション改善

#### Wave 5: 対応状況トラッキング (C3)

- `packages/shared/src/types.ts`: `AUDIT_EVENT_TYPES` に `"response_status_updated"` 追加
- `packages/db/src/types.ts`: `IntentRecord` に `responseStatus`, `responseStatusUpdatedBy`, `responseStatusUpdatedAt` フィールド追加
- `apps/api/src/routes/chat-messages.ts`:
  - `PATCH /api/chat-messages/:id/response-status` 追加（Firestore トランザクション + 監査ログ）
  - GET 一覧・詳細レスポンスに `responseStatus` 関連フィールド追加
- `apps/worker/src/pipeline/process-message.ts`: IntentRecord 初期値に `responseStatus: "unresponded"` 追加
- `apps/web/src/app/(protected)/chat-messages/[id]/response-status-control.tsx`: 対応状況操作 Client Component
  - 4ステータスボタン（未対応/対応中/対応済/対応不要）、更新者・更新日時表示
- `apps/web/src/app/(protected)/chat-messages/page.tsx`: 一覧テーブルに対応状況列追加

#### テスト修正（Wave 5 同梱）

- `apps/api/src/__tests__/auth.test.ts`, `salary-drafts.test.ts`: Wave 1 ホワイトリスト認証追加に伴う `allowedUsers` モック追加

---

## 直近の変更（Task N）

### GCP インフラ整備

Worker のコンテナ化・GCP 本番環境デプロイ・Chat App 連携が完了。

#### 変更内容

**Phase A: ローカル E2E 検証スクリプト**
- `scripts/test-worker-local.sh`: Firestore Emulator 環境での Worker ローカル検証スクリプト
- `scripts/setup-workspace-events.sh`: Phase E 用 Workspace Events 設定手順書（OAuth 問題の記録含む）

**Phase B: Dockerfile + 条件付きエクスポート**
- `apps/worker/Dockerfile`: Multi-stage build (builder/runner, linux/amd64)
- `.dockerignore`: ビルド不要ファイル除外
- `packages/*/package.json`: 条件付きエクスポート追加
  - `"types": ./src/index.ts` (TypeScript 開発時)
  - `"import": ./dist/index.js` (Node.js 本番実行時)

**Phase C: GCP セットアップ（実施済み）**
- API 有効化: Cloud Run, Artifact Registry, Pub/Sub, Workspace Events, AI Platform, Firestore
- Artifact Registry: `hr-system` リポジトリ作成 (asia-northeast1)
- SA 作成: `hr-worker` (Firestore/AI Platform 実行), `hr-pubsub-push` (Cloud Run 呼び出し)
- Firestore Native DB 作成 (asia-northeast1)
- Pub/Sub: `hr-chat-events` + `hr-chat-events-dlq` トピック作成

**Phase D: Worker Cloud Run デプロイ（済み）**
- `hr-worker` Cloud Run サービスデプロイ (asia-northeast1, 512Mi)
- Pub/Sub Push Subscription 作成 (OIDC auth, DLQ, 5回リトライ)
- E2E 動作確認: Chat メッセージ → Intent=salary (AI分類) → Firestore 保存確認済み

**Phase E: Chat App Pub/Sub 接続形式のイベント対応**
- Workspace Events API の OAuth ブロック問題を回避するため Chat App (Pub/Sub 接続) 形式にも対応
- `event-parser.ts`: `type` フィールドありの Chat App イベント形式をサポート
  - `type=MESSAGE` → 通常通りパース
  - `type=ADDED_TO_SPACE|REMOVED_FROM_SPACE|CARD_CLICKED` → null (ACK)
- `event-parser.test.ts`: Chat App イベント形式テスト追加 (4 cases)
- `docs/setup/chat-app-setup.md`: Chat App セットアップ手順書

---

## 直近の変更（Task M）

### チャットデータ収集・分析基盤

Google Chat の全メッセージをリッチに収集・分類・可視化する基盤を実装。

#### 変更内容

**packages/db**: ChatMessage/IntentRecord スキーマ大幅拡張
- スレッド (`threadName`, `parentMessageId`, `messageType`)
- メンション・アノテーション・添付ファイル (`mentionedUsers`, `annotations`, `attachments`)
- 編集・削除フラグ (`isEdited`, `isDeleted`)
- 生ペイロード (`rawPayload`)
- 分類方法追跡 (`classificationMethod`, `regexPattern`, `isManualOverride`, `originalCategory`, `overriddenBy`, `overriddenAt`)

**packages/ai**: ハイブリッド分類エンジン
- 正規表現プレ分類レイヤー (15ルール)
- confidence >= 0.85 でショートサーキット（AI コスト削減）
- フォールバック: Gemini AI 分類
- `IntentClassificationResult` に `classificationMethod`, `regexPattern` 追加

**apps/worker**: リッチデータ収集
- `event-parser.ts`: Chat API の全フィールドを取得 (`thread`, `annotations`, `attachment`, `formattedText`, `lastUpdateTime`)
- `message.updated` イベントにも対応（編集メッセージ追跡）
- `process-message.ts`: 全拡張フィールドを Firestore に保存

**apps/api**: Chat Messages エンドポイント
```
GET  /api/chat-messages         一覧（フィルタ: spaceId/messageType/threadName/category/pagination）
GET  /api/chat-messages/:id     詳細（スレッド内メッセージ含む）
PATCH /api/chat-messages/:id/intent  手動再分類（トランザクション + 監査ログ）
```

**apps/web**: チャット分析ダッシュボード
- `/chat-messages` — 一覧ページ（カテゴリ/種別フィルタ、分類方法バッジ、信頼度表示）
- `/chat-messages/:id` — 詳細ページ（スレッド可視化、手動再分類UI）
- ナビゲーションに「チャット分析」追加
- `ReclassifyForm` Client Component（PATCH API 呼び出し）

#### 既知の制限（Phase 2 対応予定）
- category フィルタ使用時、N+1 クエリにより `hasMore` の精度が低下する場合がある（Firestore JOIN 制限）
  - 解決策: ChatMessage に `intentCategory` を非正規化（Phase 2 スキーマ最適化）

---

## アーキテクチャ概要

```
apps/
  api/          Hono (TypeScript) — Cloud Run API サーバー (port 3001)
    routes/     salary-drafts.ts / employees.ts / audit-logs.ts / chat-messages.ts
    middleware/ auth.ts (JWT検証) / rbac.ts (ロール制御)
    lib/        errors.ts / pagination.ts / serialize.ts
  worker/       Hono (TypeScript) — Chat Webhook Worker (port 3002)
    routes/     pubsub.ts (POST /pubsub/push)
    middleware/ pubsub-auth.ts (OIDC 検証)
    pipeline/   process-message.ts / salary-handler.ts
    lib/        errors.ts / dedup.ts / event-parser.ts
  web/          Next.js 15 App Router — 承認ダッシュボード (port 3000)
    app/        page.tsx(統計ダッシュボード) / drafts/[id]/ / employees/ / audit-logs/
                chat-messages/ / admin/users/ / classification-rules/ / login/
    app/api/    drafts/[id]/transition/ / chat-messages/[id]/intent/ / chat-messages/[id]/response-status/
    src/auth.ts Auth.js (NextAuth v5) Google OAuth
    lib/api.ts  サーバーサイド API クライアント
packages/
  db/           Firestore 型定義・コレクション・クライアント（スキーマ拡張済み）
  shared/       DraftStatus, ApprovalAction, validateTransition 等
  salary/       確定的給与計算エンジン（LLM不使用）
  ai/           Gemini intent分類・パラメータ抽出（正規表現プレ分類レイヤー付き）
```

---

## 処理パイプライン（Task M 後の最終状態）

```
Google Chat メッセージ
  → Workspace Events API (ユーザー認証で AAAA-qf5jX0 を購読)
  → Pub/Sub トピック (hr-chat-events)
  → Worker POST /pubsub/push
    → Pub/Sub OIDC 認証 (pubsub-auth.ts)
    → event-parser: base64 decode → ChatEvent（リッチフィールド含む）
    → dedup: googleMessageId 重複チェック
    → processMessage():
        → ChatMessage 保存 (Firestore) — スレッド/メンション/添付/rawPayload 含む
        → AuditLog (chat_received)
        → tryRegexClassify() — 正規表現プレ分類 (15ルール)
            → confidence >= 0.85 なら AI スキップ
            → それ以外は classifyIntent() [Gemini]
        → IntentRecord 保存 (classificationMethod: "regex" | "ai")
        → AuditLog (intent_classified)
        → category === "salary" → handleSalary():
            → extractSalaryParams() [Gemini]
            → 従業員検索 (employeeNumber or name)
            → 現行給与取得
            → MasterData 取得 (PitchTable + AllowanceMaster)
            → salary パッケージで計算 [確定的コード]
            → SalaryDraft + SalaryDraftItems バッチ書き込み
            → AuditLog (draft_created)

HR スタッフによる手動再分類:
  → Dashboard /chat-messages/:id
  → PATCH /api/chat-messages/:id/intent
    → IntentRecord.classificationMethod = "manual"
    → originalCategory 保存（フィードバックループ）
    → AuditLog (intent_classified)

HR スタッフによる対応状況更新:
  → Dashboard /chat-messages/:id (ResponseStatusControl)
  → PATCH /api/chat-messages/:id/response-status
    → IntentRecord.responseStatus 更新
    → responseStatusUpdatedBy / responseStatusUpdatedAt 記録
    → AuditLog (response_status_updated)
```

---

## 次のアクション候補

1. **Web (Next.js) Cloud Run デプロイ**
   - `apps/web/Dockerfile` 作成 (Multi-stage build)
   - Cloud Run サービス作成: `hr-web`
   - Google OAuth 認証の本番 Redirect URI 設定
   - `AUTH_SECRET`, `API_BASE_URL` 等の環境変数を Cloud Run シークレットに設定

2. **API サーバー Cloud Run デプロイ**
   - `apps/api/Dockerfile` 作成
   - Cloud Run サービス作成: `hr-api`
   - Firebase Admin SDK の ADC 設定確認

3. **Cloud Build / CI/CD パイプライン**
   - `cloudbuild.yaml` 作成（PR マージ時に自動ビルド＆デプロイ）

4. **初期データ投入（本番 Firestore）**
   - `classificationRules` コレクションへのシードデータ投入（10カテゴリ分のルール）
   - `allowedUsers` への管理者アカウント追加

5. **E2E テスト強化**（Firestore Emulator）
   - Chat 投稿 → SalaryDraft 作成 → 承認 → 完了の一連フロー
   - `scripts/test-worker-local.sh` を CI に組み込む

6. **Phase 2 スキーマ最適化**
   - ChatMessage に `intentCategory` を非正規化（カテゴリフィルタのページネーション精度向上）
   - SmartHR / Google Sheets / Gmail 連携実装
   - Chat への Bot 返信通知（`senderEmail` を People API で実名メールに変換）

---

## API エンドポイント一覧（現時点）

```
# 給与ドラフト
GET    /api/salary-drafts              一覧（status/limit/offset フィルタ）
GET    /api/salary-drafts/:id          詳細（items + approvalLogs + nextActions）
POST   /api/salary-drafts/:id/transition  ステータス遷移（toStatus + comment）

# 従業員
GET    /api/employees                  一覧（employmentType/department/isActive フィルタ）
GET    /api/employees/:id              詳細（currentSalary 含む）

# 監査ログ
GET    /api/audit-logs                 一覧（entityType/entityId フィルタ）

# チャットメッセージ
GET    /api/chat-messages              一覧（spaceId/messageType/threadName/category フィルタ）
GET    /api/chat-messages/:id          詳細（スレッド内メッセージ + intent 含む）
PATCH  /api/chat-messages/:id/intent   手動再分類（category + comment）
PATCH  /api/chat-messages/:id/response-status  対応状況更新（responseStatus）

# 統計
GET    /api/stats/summary              総件数・本日・今週・今月
GET    /api/stats/categories           10カテゴリ別件数・割合
GET    /api/stats/timeline             日別/週別/月別トレンド（granularity/from/to）
GET    /api/stats/spaces               スペース別集計

# 管理者ユーザー
GET    /api/admin/users                一覧
POST   /api/admin/users                追加（email/displayName/role）
PATCH  /api/admin/users/:id            更新（displayName/role/isActive）
DELETE /api/admin/users/:id            削除（論理削除）

# AI分類ルール
GET    /api/classification-rules       全カテゴリのルール一覧
PATCH  /api/classification-rules/:category  ルール更新（keywords/excludeKeywords/patterns 等）
```

---

## テスト状況

| パッケージ/アプリ | テストファイル | テスト数 |
|-----------------|--------------|---------|
| packages/salary | calculator.test.ts | 境界値テスト含む |
| packages/shared | approval.test.ts + status-transitions.test.ts | |
| apps/api | auth.test.ts + health.test.ts + salary-drafts.test.ts | 22 |
| apps/worker | event-parser.test.ts + dedup.test.ts + process-message.test.ts + salary-handler.test.ts | 32 |
| apps/web | smoke.test.ts | 1 |

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

## Phase 1 の割り切り事項

| 項目 | Phase 1 実装 | Phase 2 予定 |
|------|------------|------------|
| senderEmail | Chat userId をそのまま保存 | People API 連携で実名メール取得 |
| 購読の自動更新 | 手動更新 | Cloud Scheduler による自動更新 |
| Chat への返信通知 | 未実装 | Bot 登録後に実装 |
| カテゴリフィルタ精度 | N+1 + 事前件数でhasMore判定 | intentCategory 非正規化で改善 |

---

## デプロイ環境

- **GCP Project**: hr-system-487809 (asia-northeast1)
- **Cloud Run (Worker)**: デプロイ済み — `hr-worker` (asia-northeast1, 512Mi)
  - Pub/Sub Push Subscription 接続済み (OIDC auth, DLQ, 5回リトライ)
  - Chat App (Pub/Sub 接続) からのイベント受信・Firestore 保存 E2E 確認済み
- **Cloud Run (API / Web)**: 未デプロイ（次フェーズ）
- **Artifact Registry**: `asia-northeast1-docker.pkg.dev/hr-system-487809/hr-system`
- **Firestore**: Native モード (asia-northeast1) 作成済み
- **Pub/Sub**: `hr-chat-events` + `hr-chat-events-dlq` 作成済み
- **Firebase Emulator**: `pnpm emulator` で起動 (Firestore: 8080, UI: 4000)

---

## ADR 一覧

| ADR | タイトル | Status |
|-----|---------|--------|
| ADR-001 | GCP アーキテクチャ | Accepted |
| ADR-002 | LLM 選定 (Gemini) | Accepted |
| ADR-003 | DB 選定 (Firestore) | Accepted |
| ADR-004 | Chat 統合 | Accepted |
| ADR-005 | フロントエンド技術 (Next.js) | Accepted |
| ADR-006 | Human-in-the-loop | Accepted |
| ADR-007 | AI ロール分離（金銭計算禁止） | Accepted |

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

# Worker 単体テスト
pnpm --filter @hr-system/worker test
```
