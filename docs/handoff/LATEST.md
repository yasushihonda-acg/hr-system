# HR-AI Agent — Session Handoff

**最終更新**: 2026-02-19（セッション終了時点）
**ブランチ**: `main`（Task M PR #13 マージ済み）

---

## 現在のフェーズ

**Phase 1 — コアバックエンド + 承認ダッシュボード + Chat Webhook Worker + チャット分析基盤（実装完了）**

チャットデータの完全収集・AI/正規表現ハイブリッド分類・可視化・手動再分類フィードバックループが実装されました。

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
| **Task M** | **チャットデータ収集・分析基盤** | **main (#13)** | **完了** |

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
    app/        page.tsx(一覧) / drafts/[id]/ / employees/ / audit-logs/
                chat-messages/ (★NEW) / login/
    app/api/    drafts/[id]/transition/ / chat-messages/[id]/intent/ (★NEW)
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
```

---

## 次のアクション候補

1. **GCP セットアップ**（コード実装完了、インフラ整備へ）
   - API 有効化: `workspaceevents.googleapis.com`, `chat.googleapis.com`, `pubsub.googleapis.com`
   - Pub/Sub トピック: `hr-chat-events` + DLQ: `hr-chat-events-dlq`
   - IAM: `chat-api-push@system.gserviceaccount.com` → Publisher
   - Workspace Events API 購読: ユーザー認証で `spaces/AAAA-qf5jX0` の message.created を購読
   - Push Subscription: Worker Cloud Run URL へ配信（ACK 30秒、リトライ5回）

2. **Worker ローカル動作確認**
   ```bash
   PUBSUB_SKIP_AUTH=true pnpm --filter @hr-system/worker dev
   # 別ターミナル
   curl -X POST http://localhost:3002/pubsub/push \
     -H "Content-Type: application/json" \
     -d '{"message":{"data":"<base64>","messageId":"test-1","publishTime":"2026-02-19T00:00:00Z"},"subscription":"test"}'
   ```

3. **E2E テスト**（Firestore Emulator）
   - Chat 投稿 → SalaryDraft 作成の一連フロー
   - Firebase Emulator: `pnpm emulator`

4. **Phase 2 スキーマ最適化**
   - ChatMessage に `intentCategory` を非正規化（カテゴリフィルタのページネーション精度向上）
   - SmartHR / Google Sheets / Gmail 連携実装
   - Chat への Bot 返信通知

5. **Cloud Run デプロイ設定**
   - Dockerfile, Cloud Build, CI/CD パイプライン

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
