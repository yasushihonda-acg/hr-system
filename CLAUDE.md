# HR-AI Agent - Project Instructions

## Project Overview

Google Chat の人事指示を AI が解釈し、給与変更ドラフトを自動作成。人間が承認後、全連携先へ反映する Human-in-the-loop システム。

## Architecture

- **GCP Project**: hr-system-487809 (asia-northeast1)
- **Backend**: Cloud Run (API server + Chat webhook worker)
- **Frontend**: Next.js on Cloud Run
- **Database**: Firestore (Native mode) + BigQuery (分析用)
- **AI**: Vertex AI (Gemini) — パラメータ抽出のみ。金銭計算は禁止。
- **Messaging**: Google Chat API + Pub/Sub
- **External**: SmartHR API, Google Sheets API, Gmail API

## Critical Rules

### AI Role Separation (ADR-007)
- LLM は Intent 分類とパラメータ抽出に徹する
- **金銭計算は必ず確定的プログラムコードで実行する** — LLM に計算させてはならない
- Pitch テーブル、地域手当、資格手当の参照は DB/マスターデータ経由

### Human-in-the-loop (ADR-006)
- 全 AI ドラフトに人間の承認を必須とする
- ステータス遷移: draft → reviewed → approved → processing → completed
- 機械的変更: 人事ダブルチェックのみ
- 裁量的変更: 人事チェック + 社長承認
- **ステータス遷移に行き止まりがないことを常に確認する**

### Security
- 給与情報は PII（最高機密）— ログ出力に個人情報を含めない
- 認証: Google OAuth 2.0
- DB 接続: firebase-admin SDK（ADC）
- サービスアカウントキーをコミットしない

## Key Documents

| ドキュメント | パス |
|-------------|------|
| PRD | docs/prd/PRD-001-hr-ai-agent.md |
| システム要件書 | docs/requirements/system-requirements.md |
| ADR | docs/adr/ADR-001〜007 |

## Data Model (Primary Entities)

- **Employee**: 従業員マスタ（正社員・パート・登録訪問看護師すべて）
- **SalaryDraft**: AI 生成の給与変更ドラフト（Before/After）
- **ChatMessage**: チャット原文 + Intent 分類結果
- **ApprovalLog**: 承認ワークフローの全履歴
- **MasterData**: Pitch テーブル、地域手当、資格手当、役職手当

## Chat Integration

- **監視スペース**: 人事関連（全社共通）、有川チーム
- **スペースID**: AAAA-qf5jX0
- **制約**: このスペースは外部ユーザー・ボットを招待不可（内部ドメインのみ）。hr-worker SA を Chat App としてインストールできないため、`chat.bot` スコープの REST API はスペースメンバーでないエラーになる
- **Chat API 制約**: `spaces.messages.get` / `spaces.members.get` は `displayName` を返さない（ユーザー認証スコープ問題）。displayName が必要な場合は People API（`directory.readonly` スコープ）を使用すること
- **開発者認証**: スペース操作はすべて開発者アカウントの ADC で実施。再認証コマンド:
  ```
  gcloud auth application-default login \
    --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/chat.messages.readonly,https://www.googleapis.com/auth/chat.memberships.readonly,https://www.googleapis.com/auth/directory.readonly"
  ```
- **10カテゴリ分類**: 給与・社保 / 退職・休職 / 入社・採用 / その他 / 契約変更 / 施設・異動 / 外国人・ビザ / 研修・監査 / 健康診断 / 勤怠・休暇
- Phase 1 では給与変更のみ処理、他はログ記録

## Testing Guidelines

- 給与計算ロジックは境界値テスト必須（Pitch 最小/最大/±1）
- ステータス遷移の全パスをテスト（正常系 + 差し戻し）
- AI パラメータ抽出はモックで分離テスト
- E2E: Chat 投稿 → ドラフト生成 → 承認 → 通知の一連フロー

## Project Structure (Monorepo)

```
apps/
  api/          Hono (TypeScript) — Cloud Run API サーバー
  web/          Next.js 15 (App Router) — 承認ダッシュボード
packages/
  db/           Firestore — 型定義・コレクション・クライアント
  shared/       共通型定義 (DraftStatus, ChatCategory 等)
```

## Conventions

- 言語: TypeScript (Backend/Frontend 共通)
- Monorepo: Turborepo + pnpm workspaces
- Lint/Format: Biome
- Test: Vitest
- DB: firebase-admin SDK + Firestore Data Converter
- コレクション設計: docs/adr/ADR-003 参照
- API: RESTful, JSON
- 監査ログ: 全操作を AuditLog テーブルに記録（7年保持）

## Commands

- `pnpm dev` — 全サービス起動 (API: 3001, Web: 3000)
- `pnpm build` — 全パッケージビルド
- `pnpm lint` — Biome lint
- `pnpm typecheck` — TypeScript型チェック
- `pnpm test` — Vitest テスト実行
- `pnpm emulator` — Firebase Emulator 起動 (Firestore: 8080, UI: 4000)
- `pnpm db:seed` — シードデータ投入
