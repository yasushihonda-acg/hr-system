# HR-AI Agent — Session Handoff

**最終更新**: 2026-04-13（Firestore UserStore 有効化セッション）
**ブランチ**: `main`
**main 最新**: `62263db` — docs: 権限モデルのドキュメントを詳細化 + ハンドオフ更新 (#433)

---

## 現在のフェーズ

**Phase 12 — SmartHR MCP サーバー構築（UserStore 有効化・本番運用中）**

### 今セッションの成果

1. **Firestore UserStore 有効化**（PR #432）
   - `USE_FIRESTORE_USER_STORE=true` に変更（Cloud Run rev mcp-smarthr-00018-tts）
   - Firestore `mcp-users` コレクションに10名登録（admin 4名 + readonly 6名）
   - ドメイン内でも未登録アカウントはアクセス不可（fail-closed）

2. **ドキュメント詳細化**（PR #433）
   - `/docs` 技術ドキュメント: ロール別カード + ツール×ロール マトリクスに刷新
   - `/guide` ご利用ガイド: アクセス制限説明を許可リスト方式に更新
   - ハンドオフ: 登録ユーザー一覧セクション追加

3. **カスタムコネクタ動作確認**
   - claude.ai でカスタムコネクタ接続 + データ取得を確認済み
   - 読み取り専用ツール6つ、書き込み/削除ツール2つが正しく表示

### マージ済み PR

| PR | 内容 | 状態 |
|----|------|------|
| #432 | Firestore UserStore 有効化 + 初期ユーザー10名登録スクリプト | マージ済 |
| #433 | 権限モデルのドキュメント詳細化 + UserStore有効化反映 | マージ済 |

---

## 登録ユーザー（Firestore `mcp-users`）

| ロール | 権限 | アカウント |
|--------|------|-----------|
| **admin** | 閲覧 + 更新 + 登録 + 給与明細 | kosuke.omure, tomohiro.arikawa, makoto.tokunaga, yasushi.honda |
| **readonly** | 閲覧のみ | ryota.yagi, gen.ichihara, rika.komatsu, shoma.horinouchi, tomoko.hommura, yuka.yoshimura |

- 未登録の @aozora-cg.com アカウントはアクセス不可（fail-closed）
- 削除操作は全ロールで不可（未実装・スコープ外）
- ユーザー追加・変更: `npx tsx packages/mcp-smarthr/scripts/seed-users.ts` を編集して実行

---

## 次のアクション

### 即時（次セッション）

1. **Cowork で CRUD 動作確認**
   - admin ユーザーで `update_employee` / `create_employee` が実行されること
   - readonly ユーザーでは write ツールが拒否されること
   - 未登録アカウントで接続が拒否されること

2. **GCP Owner 切り替え**（請求先アカウント確認後）
   - dx@aozora-cg.com → shoma.horinouchi@aozora-cg.com + yasushi.honda@aozora-cg.com のみに変更
   - 請求先アカウントの関係で単純でない可能性あり、システム部部長と要調整

### Phase F2: Cloud Armor IP 制限（優先度低）
- Cloud Armor ポリシーで Anthropic IP 範囲を許可
- アプリ内の XFF パースコード削除

### 既存 Issues
- #407: Phase 2: Anthropic HR Plugin 導入
- #408: Phase 3: 本番 AI エージェント + 実験 UI

---

## 重要な設計判断

| 判断 | 決定 | 理由 |
|------|------|------|
| 権限モデル | パーミッション文字列方式 | "read"/"write"/"pay_statements" の3値で十分 |
| アクセス制御 | Firestore 許可リスト方式 | ドメイン内全員アクセスは機密性リスクが高い |
| 2フェーズ書き込み | 不要 | MCP のAI確認フローが代替 |
| フィールド許可リスト | ハードコード（ランタイム強制） | セキュリティ上、コードレビュー経由 |
| POST リトライ | 禁止 | 非冪等操作の重複リスク |
| OAuth AS | 自前（Google OIDC 委譲） | 10-30名の社内ツール |
| JWT | HS256, 1時間有効 | 短寿命でセキュリティ確保 |
| fail-closed | UserStore null → 拒否 | PII 保護 |
| CRUD | PATCH + POST のみ | DELETE スコープ外 |

---

## MCP ツール一覧（8ツール）

| ツール | 権限 | SmartHR API |
|--------|------|-------------|
| list_employees | read | GET /crews |
| get_employee | read | GET /crews/{id} |
| search_employees | read | GET /crews?q= |
| list_departments | read | GET /departments |
| list_positions | read | GET /positions |
| get_pay_statements | pay_statements | GET /pay_statements |
| update_employee | write | PATCH /crews/{id} |
| create_employee | write | POST /crews |

---

## GCP IAM（ユーザーアカウントのみ）

| アカウント | ロール | 備考 |
|-----------|--------|------|
| dx@aozora-cg.com | Owner | システムアカウント（プロジェクト作成者） |
| yasushi.honda@aozora-cg.com | Owner | 開発者 |

※ システム部個人アカウントは未付与。後日 Owner 切り替え予定。

---

## 公開ドキュメント

| ページ | URL |
|--------|-----|
| 技術ドキュメント | /docs |
| ご利用ガイド | /guide |

---

## Cloud Run 環境変数

| 変数 | 値 | 備考 |
|------|-----|------|
| AUTH_DISABLED | false | OAuth 2.1 有効 |
| USE_FIRESTORE_USER_STORE | **true** | PR #432 で有効化済み |
| IP_RESTRICTION_ENABLED | false | Cloud Armor 移行予定 |

---

## デプロイ環境

| サービス | 状態 |
|---------|------|
| Cloud Run (MCP) | rev 00018 稼働中（UserStore 有効化） |
| Cloud Run (Worker) | デプロイ済み |
| Cloud Run (API) | デプロイ済み |
| Cloud Run (Web) | デプロイ済み |

---

## テスト状況

| パッケージ | テスト数 | 状態 |
|-----------|---------|------|
| packages/mcp-smarthr | **98** | 全PASS |
| apps/api | 22+ | 全PASS |
| apps/worker | 80 | 全PASS |
| apps/web | 207 | 全PASS |

---

## 再開手順

```bash
cd /Users/yyyhhh/Projects/ACG/hr-system
git checkout main && git pull

# Cloud Run 状態確認
curl -s https://mcp-smarthr-1021020088552.asia-northeast1.run.app/health

# 次のタスク:
# 1. Cowork で CRUD 動作確認（admin / readonly / 未登録）
# 2. GCP Owner 切り替え（請求先アカウント確認後）
```
