# HR-AI Agent — Session Handoff

**最終更新**: 2026-02-22（セッション終了時点）
**ブランチ**: `main`（最新コミット: `352b47c` — 全変更 push 済み、未プッシュなし）

---

## 現在のフェーズ

**Phase 2 — チャット分析 UI 刷新 + バグ修正 完了 (PR #62/#65/#68 マージ済み)**

チャットパイプラインのメタデータ欠損バグ修正・カードフィードUI刷新・メンション表示修正が main にマージ済み。
現在オープン Issue: #63（既存データ修復）, #67（カードUI品質改善）いずれも P2。

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

---

## 直近の変更（最新4件）

### fix(web): メンション表示バグ修正 & 空senderName対応 (352b47c, PR #68) — Closes #66
- `senderName` が空の場合のフォールバック対応（アバター・送信者名）
- `<users/ID>` 形式メンション表示の追加修正

### feat(web): チャット分析ページをカードフィードUIに刷新 (d602c00, PR #65) — Closes #64
- チャットメッセージ一覧をカードフィードデザインに刷新
- アバター・送信者名・日時・カテゴリバッジを含むカードUI

### fix: チャットパイプラインのメタデータ欠損バグ修正 (ab4b2ff, PR #62) — Closes #60 #61
- 定期同期 (`chat-sync.ts`) と Worker (`enrich-event.ts`) のメタデータ欠損を修正
- `senderName`, `annotations`, `attachments`, `parentMessageId` の欠損を解消（新規メッセージ以降有効）

### fix(chat): `<users/ID>` 形式メンション修正 (7f0de5a, PR #59) — Closes #56 #57 #58
- Google Chat API の `<users/12345>` 形式を `ContentWithMentions` で正しく `MentionBadge` に変換
- `resolveUserMentions` ユニットテスト 6件追加

---

## 次のアクション候補

1. **Issue #63（P2）**: 既存 Firestore データの修復（バックフィルスクリプトへの `--repair` フラグ追加）
   - `senderName`, `annotations` 欠損ドキュメントを Chat REST API で補完
   - 詳細は Issue #63 参照
2. **Issue #67（P2）**: チャット分析カードUIの視覚的クオリティ改善
   - `senderName` 空時のアバターフォールバック（"不明"）強化
   - カードシャドウ・タイポグラフィ・背景色調整
3. **Cloud Run 本番シークレット設定**（必要な場合）
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `API_BASE_URL`
4. **Google OAuth 本番 Redirect URI 設定**
   - GCP Console > APIs & Services > Credentials
5. **SmartHR / Google Sheets / Gmail 連携実装**（Phase 2 後半）

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
| #67 | チャット分析カードUIの視覚的クオリティ改善 | enhancement | P2 |
| #63 | 既存 Firestore データの修復（メタデータ補完） | enhancement | P2 |

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
