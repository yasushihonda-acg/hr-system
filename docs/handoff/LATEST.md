# HR-AI Agent — Session Handoff

**最終更新**: 2026-02-19
**ブランチ**: `main`

---

## 現在のフェーズ

**Phase 1 — コアバックエンド + 承認ダッシュボード + Chat Webhook Worker（実装完了）**

Chat → Pub/Sub → Worker のエンドツーエンドパイプラインが実装されました。

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
| **Task L** | **Chat Webhook Worker** | **main (未コミット)** | **実装完了** |

---

## 直近の変更（現セッション）

### Chat Webhook Worker (`apps/worker/`)

Pub/Sub push イベントを受信し、AI 分類 → 給与計算 → SalaryDraft 作成までを自動処理。

**ディレクトリ構成:**
```
apps/worker/
  package.json              @hr-system/worker
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  .env.example
  src/
    index.ts                エントリポイント (port 3002)
    app.ts                  Hono アプリ + ルートマウント
    middleware/
      pubsub-auth.ts        Pub/Sub OIDC トークン検証
    routes/
      pubsub.ts             POST /pubsub/push
    lib/
      errors.ts             WorkerError + workerErrorHandler
      dedup.ts              googleMessageId 重複排除
      event-parser.ts       Pub/Sub → ChatEvent 変換
    pipeline/
      process-message.ts    メインオーケストレーター
      salary-handler.ts     給与カテゴリ専用ハンドラ
    __tests__/
      event-parser.test.ts  12 tests
      dedup.test.ts          3 tests
      process-message.test.ts 7 tests
      salary-handler.test.ts 10 tests
```

**テスト結果**: 32/32 パス、typecheck OK、lint クリーン

---

## アーキテクチャ概要

```
apps/
  api/          Hono (TypeScript) — Cloud Run API サーバー (port 3001)
    routes/     salary-drafts.ts / employees.ts / audit-logs.ts
    middleware/ auth.ts (JWT検証) / rbac.ts (ロール制御)
    lib/        errors.ts / pagination.ts / serialize.ts
  worker/       Hono (TypeScript) — Chat Webhook Worker (port 3002)
    routes/     pubsub.ts (POST /pubsub/push)
    middleware/ pubsub-auth.ts (OIDC 検証)
    pipeline/   process-message.ts / salary-handler.ts
    lib/        errors.ts / dedup.ts / event-parser.ts
  web/          Next.js 15 App Router — 承認ダッシュボード (port 3000)
    app/        page.tsx(一覧) / drafts/[id]/ / employees/ / audit-logs/ / login/
    src/auth.ts Auth.js (NextAuth v5) Google OAuth
    lib/api.ts  サーバーサイド API クライアント
packages/
  db/           Firestore 型定義・コレクション・クライアント
  shared/       DraftStatus, ApprovalAction, validateTransition 等
  salary/       確定的給与計算エンジン（LLM不使用）
  ai/           Gemini intent分類・パラメータ抽出（金銭計算なし）
```

---

## 処理パイプライン

```
Google Chat メッセージ
  → Workspace Events API (ユーザー認証で AAAA-qf5jX0 を購読)
  → Pub/Sub トピック (hr-chat-events)
  → Worker POST /pubsub/push
    → Pub/Sub OIDC 認証 (pubsub-auth.ts)
    → event-parser: base64 decode → ChatEvent
    → dedup: googleMessageId 重複チェック
    → processMessage():
        → ChatMessage 保存 (Firestore)
        → AuditLog (chat_received)
        → classifyIntent() [Gemini]
        → IntentRecord 保存
        → AuditLog (intent_classified)
        → category === "salary" → handleSalary():
            → extractSalaryParams() [Gemini]
            → 従業員検索 (employeeNumber or name)
            → 現行給与取得
            → MasterData 取得 (PitchTable + AllowanceMaster)
            → salary パッケージで計算 [確定的コード]
            → SalaryDraft + SalaryDraftItems バッチ書き込み
            → AuditLog (draft_created)
```

---

## 次のアクション候補

1. **Worker をコミット → PR → main マージ**
   ```bash
   git checkout -b feat/chat-webhook-worker
   git add apps/worker/ docs/handoff/
   git commit -m "feat(worker): Chat Webhook Worker (Task L)"
   gh pr create
   ```

2. **GCP セットアップ**（コード実装後の次ステップ）
   - API 有効化: `workspaceevents.googleapis.com`, `chat.googleapis.com`, `pubsub.googleapis.com`
   - Pub/Sub トピック: `hr-chat-events` + DLQ: `hr-chat-events-dlq`
   - IAM: `chat-api-push@system.gserviceaccount.com` → Publisher
   - Workspace Events API 購読: ユーザー認証で `spaces/AAAA-qf5jX0` の message.created を購読
   - Push Subscription: Worker Cloud Run URL へ配信（ACK 30秒、リトライ5回）

3. **Worker ローカル動作確認**
   ```bash
   PUBSUB_SKIP_AUTH=true pnpm --filter @hr-system/worker dev
   # 別ターミナル
   curl -X POST http://localhost:3002/pubsub/push \
     -H "Content-Type: application/json" \
     -d '{"message":{"data":"<base64>","messageId":"test-1","publishTime":"2026-02-19T00:00:00Z"},"subscription":"test"}'
   ```

4. **E2E テスト**（Firestore Emulator）
   - Chat 投稿 → SalaryDraft 作成の一連フロー
   - Firebase Emulator: `pnpm emulator`

5. **SmartHR / Google Sheets / Gmail 連携実装**
   - approved → processing → completed 遷移時の外部連携

6. **Cloud Run デプロイ設定**
   - Dockerfile, Cloud Build, CI/CD パイプライン

---

## テスト状況

| パッケージ/アプリ | テストファイル | テスト数 |
|-----------------|--------------|---------|
| packages/salary | calculator.test.ts | 境界値テスト含む |
| packages/shared | approval.test.ts + status-transitions.test.ts | |
| apps/api | auth.test.ts + health.test.ts + salary-drafts.test.ts | 22 |
| apps/worker | event-parser.test.ts + dedup.test.ts + process-message.test.ts + salary-handler.test.ts | **32** |
| apps/web | なし（未実装） | — |

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
| DB ヘルパーの共通化 | Worker 内に直接実装 | packages/db に移動 |

---

## デプロイ環境

- **GCP Project**: hr-system-487809 (asia-northeast1)
- **Cloud Run**: 未デプロイ（ローカル開発中）
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
