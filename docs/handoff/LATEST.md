# HR-AI Agent — Session Handoff

**最終更新**: 2026-02-19
**ブランチ**: `feat/web-dashboard`（main に未マージ）

---

## 現在のフェーズ

**Phase 1 — コアバックエンド + 承認ダッシュボード（実装中）**

MVP の主要バックエンド機能は main にマージ済み。現在のブランチ（`feat/web-dashboard`）に Next.js 承認ダッシュボードが実装され、未プッシュ・未マージの状態。

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
| Task K | Next.js 承認ダッシュボード (Auth.js + shadcn/ui) | feat/web-dashboard (68f7bd6) | 実装済み・**未マージ** |

---

## 直近の変更（直近1週間）

1. **feat(web): add approval dashboard** (68f7bd6) — feat/web-dashboard
   - Auth.js (NextAuth v5) + Google OAuth でログイン
   - 給与ドラフト一覧ページ（ステータスフィルタ・ページネーション）
   - ドラフト詳細ページ（Before/After 比較、承認アクションボタン）
   - 従業員一覧ページ、監査ログページ
   - shadcn/ui コンポーネント（Table, Card, Badge, Button など）
   - API クライアント (`apps/web/src/lib/api.ts`) — Bearer トークン付き

2. **feat(api): implement REST API endpoints** (8a58a29) — main (#10)
   - `GET/PATCH /drafts`, `POST /drafts/:id/transition`
   - `GET /employees`, `GET /employees/:id`
   - `GET /audit-logs`
   - Zod バリデーション、ページネーション、エラーハンドリング

---

## アーキテクチャ概要

```
apps/
  api/          Hono (TypeScript) — Cloud Run API サーバー (port 3001)
    routes/     salary-drafts.ts / employees.ts / audit-logs.ts
    middleware/ auth.ts (JWT検証) / rbac.ts (ロール制御)
    lib/        errors.ts / pagination.ts / serialize.ts
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

## 次のアクション候補

1. **feat/web-dashboard を PR → main へマージ**
   - `git push -u origin feat/web-dashboard`
   - `gh pr create` でレビュー依頼
   - CI（typecheck / lint / test）がパスすることを確認

2. **E2E テスト追加**（CLAUDE.md の Testing Guidelines に従い）
   - Chat 投稿 → ドラフト生成 → 承認 → 通知の一連フロー
   - Playwright or Vitest + Firebase Emulator

3. **Chat Webhook Worker 実装**
   - Google Chat イベント受信 → Pub/Sub → Gemini 分類 → SalaryDraft 生成
   - 未着手タスク

4. **SmartHR / Google Sheets / Gmail 連携実装**
   - approved → processing → completed 遷移時の外部連携
   - 未着手タスク

5. **Cloud Run デプロイ設定**
   - Dockerfile, Cloud Build, CI/CD パイプライン
   - 未着手タスク

---

## 未コミット・未プッシュの変更

| ファイル | 状態 | 対応 |
|---------|------|------|
| `.gitconfig.local` | untracked | .gitignore 対象（direnv 関連）— コミット不要 |
| `.serena/` | untracked | .gitignore 対象（IDE メモリ）— コミット不要 |
| `apps/web/next-env.d.ts` | untracked | Next.js 自動生成 — `.gitignore` に追加を検討 |
| `feat/web-dashboard` ブランチ全体 | 未プッシュ | **次のアクション: `git push -u origin feat/web-dashboard`** |

---

## テスト状況

| パッケージ/アプリ | テストファイル | 件数（概算） |
|-----------------|--------------|-------------|
| packages/salary | calculator.test.ts | 262行（境界値テスト含む） |
| packages/shared | approval.test.ts + status-transitions.test.ts | 264行 |
| apps/api | auth.test.ts + health.test.ts + salary-drafts.test.ts | 620行 |
| apps/web | なし（未実装） | — |

---

## ステータス遷移（ADR-006 準拠）

```
draft → reviewed → approved → processing → completed
          ↓           ↓
       rejected    rejected
```

行き止まりなし（rejected は再ドラフト可能な設計）

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

# ブランチ確認
git branch  # feat/web-dashboard にいること

# 開発サーバー起動
pnpm dev    # API: 3001, Web: 3000

# Firebase Emulator（別ターミナル）
pnpm emulator

# テスト実行
pnpm test

# PR 作成（次のアクション）
git push -u origin feat/web-dashboard
gh pr create
```
