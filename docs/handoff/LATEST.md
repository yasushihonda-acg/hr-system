# HR-AI Agent — Session Handoff

**最終更新**: 2026-04-13（セッション終了時点）
**ブランチ**: `main`
**main 最新**: `291ac85` — docs: Team プランのコネクタ共有の説明を追加 (#430)

---

## 現在のフェーズ

**Phase 12 — SmartHR MCP サーバー構築（Phase G 完了・CRUD 本番デプロイ済み）**

### 今セッションの成果

1. **Phase G: CRUD 操作追加**（PR #423）
   - SmartHR Client に PATCH/POST メソッド追加（キャッシュ無効化付き）
   - `update_employee` ツール（PATCH /crews/{id}、フィールド許可リスト強制）
   - `create_employee` ツール（POST /crews、必須フィールド min(1) バリデーション）
   - 空値除去（undefined / null / 空文字列 / 空白のみ → SmartHR データ消失防止）

2. **パーミッションベース認可**（PR #423）
   - `Permission = "read" | "write" | "pay_statements"` 型追加
   - アカウント毎に細粒度の CRUD 権限制御が可能
   - 後方互換: 既存 role のみユーザーは ROLE_TO_PERMISSIONS で自動導出
   - Firestore permissions フィールドのランタイム検証

3. **レビュー指摘対応**（5エージェント並列レビュー）
   - POST の 429 リトライ禁止（非冪等操作の重複実行防止）
   - UPDATABLE_FIELDS をランタイムで強制（defense-in-depth）
   - stripEmptyValues で null・空白文字列も除去
   - キャッシュ無効化を try-catch で保護
   - Firestore permissions のランタイム検証追加

4. **Cloud Run デプロイ + SmartHR API 実接続テスト**
   - PATCH フォーマット検証OK（同値更新で 200 確認）
   - POST フォーマット検証OK（201 確認、テスト従業員は即削除済み）

5. **ドキュメント最終更新**（PR #425〜#430）
   - `/docs` 技術ドキュメント: OAuth 2.1・8ツール・パーミッション・SmartHR API リンク
   - `/guide` 非エンジニア向けご利用ガイド: 新規作成
   - README に MCP セクション + ドキュメントリンク追加
   - UI 表記を日本語版 Claude に統一、ファビコン追加
   - Team プランのコネクタ共有説明追加

### マージ済み PR

| PR | 内容 | 状態 |
|----|------|------|
| #423 | Phase G: CRUD 操作 + パーミッションベース認可 | マージ済 |
| #424 | ハンドオフ更新（Phase G 完了） | マージ済 |
| #425 | ドキュメント Phase G 対応 + ガイド追加 | マージ済 |
| #426 | UI 表記を日本語版 Claude に修正 | マージ済 |
| #427 | README に MCP セクション追加 | マージ済 |
| #428 | ファビコン追加 | マージ済 |
| #429 | docs を OAuth 2.1 + SmartHR API リンクに更新 | マージ済 |
| #430 | Team プランのコネクタ共有説明追加 | マージ済 |

---

## 次のアクション

### 即時（次セッション）

1. **チームプラン カスタムコネクタ有効化**
   - 組織オーナー（社長）が設定 > コネクタ > カスタムコネクタを追加
   - オーナーが1回登録すれば、メンバーは「連携させる」をクリックするだけ
   - チームメンバーの接続テスト

2. ~~**Firestore UserStore 有効化 + ユーザー登録**~~ ✅ 完了（PR #432）
   - `USE_FIRESTORE_USER_STORE=true` に変更済み（rev mcp-smarthr-00018-tts）
   - 10名登録済み（admin 4名 + readonly 6名）

3. **Cowork で CRUD 動作確認**
   - admin ユーザーで `update_employee` / `create_employee` が実行されること
   - readonly ユーザーでは write ツールが拒否されること
   - 未登録アカウントで接続が拒否されること

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
| 2フェーズ書き込み | 不要 | MCP のAI確認フローが代替 |
| フィールド許可リスト | ハードコード（ランタイム強制） | セキュリティ上、コードレビュー経由 |
| POST リトライ | 禁止 | 非冪等操作の重複リスク |
| OAuth AS | 自前（Google OIDC 委譲） | 10-30名の社内ツール |
| JWT | HS256, 1時間有効 | 短寿命でセキュリティ確保 |
| fail-closed | UserStore null → 拒否 | PII 保護 |
| CRUD | PATCH + POST のみ | DELETE スコープ外 |

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
# 1. チームプラン カスタムコネクタ有効化（社長操作）
# 2. USE_FIRESTORE_USER_STORE=true + ユーザー登録
# 3. Cowork で CRUD 動作確認
```
