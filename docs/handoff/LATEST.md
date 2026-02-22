# HR-AI Agent — Session Handoff

**最終更新**: 2026-02-22（セッション終了時点）
**ブランチ**: `main`（最新コミット: `7f0de5a` — 全変更 push 済み、未プッシュなし）

---

## 現在のフェーズ

**Phase 2 — 分類フィードバック学習ループ + ダッシュボード強化 実装完了（PR #54/#55 マージ済み）**

Issue #17「分類フィードバック学習ループ」および Issue #19「ダッシュボード強化」が完了し main にマージ済み。
Deploy to Cloud Run CI が進行中（#55 マージトリガー）。

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
| **#17** | **分類フィードバック学習ループ（精度可視化・手動修正分析・CSVエクスポート）** | **main (#54)** | **完了** |
| **#19** | **ダッシュボード強化（要確認フィルタ・カテゴリ分布グラフ）** | **main (#55)** | **完了** |
| **#56/#57/#58** | **チャットメンション表示修正（`<users/ID>` 形式対応）** | **main (#59)** | **完了** |

---

## 直近の変更（最新4件）

### fix(chat): `<users/ID>` 形式メンション修正 (7f0de5a, PR #59) — Closes #56 #57 #58
- Google Chat API の `<users/12345>` 形式を `ContentWithMentions` で正しく `MentionBadge` に変換
- `mentionedUsers` prop を追加し、一覧・詳細・ThreadView へ伝搬
- API: `threadMessages` レスポンスに `mentionedUsers` フィールド追加
- `resolveUserMentions` ユニットテスト 6件追加

### feat: Issue #19 ダッシュボード強化 (1e0d147, PR #55) — Closes #19
- 要確認フィルタ（ステータスフィルタ UI 強化）
- カテゴリ分布グラフ追加（チャット分析ダッシュボード）

### feat: 分類フィードバック学習ループ (e1e6893, PR #54) — Closes #17
- `/api/intent-stats` エンドポイント群（概要・混同行列・上位エラーパターン・CSV）
- Web ダッシュボード「Classification Accuracy」タブ（精度チャート・混同行列・オーバーライドパターン）
- `apps/api/src/__tests__/intent-stats.test.ts` — ユニットテスト追加（11テスト）

### fix(ci): API Dockerfile に packages/ai を追加 (6349333, PR #53)
- ビルド失敗（`@hr-system/ai` not found）を修正

---

## 次のアクション候補

1. **CI完了確認**: Deploy to Cloud Run (#55 トリガー) が進行中 → 完了後に本番 URL で動作確認
2. **Cloud Run 本番シークレット設定**（API/Web 未デプロイの場合）
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `API_BASE_URL` を Cloud Run シークレットへ設定
   - `gcloud run deploy hr-api` / `hr-web` 実行
3. **Google OAuth 本番 Redirect URI 設定**
   - GCP Console > APIs & Services > Credentials で `https://[hr-web URL]/api/auth/callback/google` を追加
4. **Issue #19**: 分類分析ダッシュボード強化 — カテゴリ傾向分析・精度可視化追加（P3）
5. **Phase 2 スキーマ最適化**
   - SmartHR / Google Sheets / Gmail 連携実装

---

## デプロイ環境

| サービス | 状態 | URL/識別子 |
|---------|------|-----------|
| Cloud Run (Worker) | デプロイ済み | `hr-worker` (asia-northeast1) |
| Cloud Run (API) | デプロイ中（#59 CI進行中） | `hr-api` (asia-northeast1) |
| Cloud Run (Web) | デプロイ中（#59 CI進行中） | `hr-web` (asia-northeast1) |
| Artifact Registry | 作成済み | `asia-northeast1-docker.pkg.dev/hr-system-487809/hr-system` |
| Firestore | 本番稼働中 | Native モード (asia-northeast1) |
| Pub/Sub | 稼働中 | `hr-chat-events` + `hr-chat-events-dlq` |
| GitHub Actions | CI完了・Deploy進行中 | `.github/workflows/deploy.yml` |

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

| # | タイトル | ラベル |
|---|---------|--------|
（#17, #19 は PR #54/#55 でクローズ済み。現在オープン Issue なし）

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
