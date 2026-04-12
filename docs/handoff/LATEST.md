# HR-AI Agent — Session Handoff

**最終更新**: 2026-04-13（セッション終了時点）
**ブランチ**: `main`
**main 最新**: `faec4ba` — feat: SmartHR MCP CRUD 操作追加 + パーミッションベース認可（Phase G） (#423)

---

## 現在のフェーズ

**Phase 12 — SmartHR MCP サーバー構築（Phase G 完了・CRUD 本番デプロイ済み）**

### 今セッションの成果

1. **Phase G: CRUD 操作追加**（PR #423）
   - G1: SmartHR Client に PATCH/POST メソッド追加（キャッシュ無効化付き）
   - G2: `update_employee` ツール（PATCH /crews/{id}、フィールド許可リスト強制）
   - G3: `create_employee` ツール（POST /crews、必須フィールド min(1) バリデーション）
   - G4: 空値除去（undefined / null / 空文字列 / 空白のみ → SmartHR データ消失防止）

2. **パーミッションベース認可**（PR #423）
   - `Permission = "read" | "write" | "pay_statements"` 型追加
   - アカウント毎に細粒度の CRUD 権限制御が可能
   - 後方互換: 既存 role のみユーザーは ROLE_TO_PERMISSIONS で自動導出
   - Firestore permissions フィールドのランタイム検証（不正値はロールにフォールバック）

3. **レビュー指摘対応**（5エージェント並列レビュー）
   - POST の 429 リトライ禁止（非冪等操作の重複実行防止）
   - UPDATABLE_FIELDS をランタイムで強制（defense-in-depth）
   - stripEmptyValues で null・空白文字列も除去
   - キャッシュ無効化を try-catch で保護（書き込み成功を隠さない）
   - 古いコメント4箇所修正（ロール別→パーミッションベース）

4. **Cloud Run デプロイ + SmartHR API 実接続テスト**
   - rev 00012 デプロイ完了
   - PATCH フォーマット検証OK（同値更新で 200 確認）
   - POST フォーマット検証OK（201 確認、テスト従業員は即削除済み）

### マージ済み PR

| PR | 内容 | 状態 |
|----|------|------|
| #423 | Phase G: CRUD 操作 + パーミッションベース認可 | マージ済 |

---

## 次のアクション

### 即時（次セッション）

1. **チームプラン カスタムコネクタ有効化**
   - 組織オーナー（社長）がカスタムコネクタ追加を許可
   - チームメンバーの接続テスト

2. **Firestore UserStore 有効化 + ユーザー登録**
   - `USE_FIRESTORE_USER_STORE=true` に変更
   - ユーザー登録（ここの Claude Code セッションで直接実行）
   - 権限例: admin=`["read", "write", "pay_statements"]`, editor=`["read", "write"]`, viewer=`["read"]`

3. **Cowork で CRUD 動作確認**
   - admin ユーザーで `update_employee` / `create_employee` が表示・実行されること
   - readonly ユーザーでは write ツールが拒否されること

### Phase F2: Cloud Armor IP 制限（優先度低）
- Cloud Armor ポリシーで Anthropic IP 範囲（160.79.104.0/21）を許可
- アプリ内の XFF パースコード削除
- IP_RESTRICTION_ENABLED 環境変数廃止

### 既存 Issues
- #407: Phase 2: Anthropic HR Plugin 導入
- #408: Phase 3: 本番 AI エージェント + 実験 UI

---

## 重要な設計判断（確定済み + 今セッション追加）

| 判断 | 決定 | 理由 |
|------|------|------|
| 権限モデル | パーミッション文字列方式 | ロール階層では粒度不足。"read"/"write"/"pay_statements" の3値で十分 |
| 2フェーズ書き込み | 不要（スキップ） | MCP のAI確認フローが prepare/confirm の役割を果たす |
| フィールド許可リスト | ハードコード（ランタイム強制） | セキュリティ上、設定変更はコードレビュー経由 |
| POST リトライ | 禁止 | 非冪等操作の重複実行リスク回避 |
| 空値除去 | null・空白含む全除去 | SmartHR API の空上書きによるデータ消失防止 |
| OAuth AS | 自前（Google OIDC 委譲） | 10-30名の社内ツール。Auth0 は過剰 |
| JWT | HS256, 1時間有効, aud/iss バインド | 短寿命でセキュリティ確保 |
| fail-closed | UserStore null → アクセス拒否 | HR データ（PII）保護 |
| CRUD 方針 | PATCH + POST のみ（DELETE スコープ外） | SmartHR 退職は PATCH resigned_at |
| CORS | ホワイトリスト | claude.ai, Cowork, 自サーバーのみ |

---

## MCP ツール一覧（8ツール）

| ツール | 権限 | 説明 |
|--------|------|------|
| list_employees | read | 従業員一覧 |
| get_employee | read | 従業員詳細 |
| search_employees | read | 従業員検索 |
| list_departments | read | 部署一覧 |
| list_positions | read | 役職一覧 |
| get_pay_statements | pay_statements | 給与明細 |
| **update_employee** | **write** | **従業員更新（PATCH）** |
| **create_employee** | **write** | **従業員登録（POST）** |

## パーミッション設計

```
Permission = "read" | "write" | "pay_statements"

Firestore mcp-users/{email}:
{
  role: "admin" | "readonly",       // レガシー（後方互換）
  permissions?: Permission[],        // 細粒度制御（あればこちら優先）
  enabled: boolean
}
```

---

## Cloud Run 環境変数（現在の設定）

| 変数 | 値 | 備考 |
|------|-----|------|
| NODE_ENV | production | |
| ALLOWED_DOMAIN | aozora-cg.com | |
| SMARTHR_API_KEY | Secret Manager | smarthr-api-key:latest |
| SMARTHR_TENANT_ID | Secret Manager | smarthr-tenant-id:latest |
| GOOGLE_CLIENT_ID | Secret Manager | GOOGLE_CLIENT_ID:latest |
| GOOGLE_CLIENT_SECRET | Secret Manager | GOOGLE_CLIENT_SECRET:latest |
| JWT_SECRET | Secret Manager | mcp-jwt-secret:latest |
| SERVER_URL | https://mcp-smarthr-bdr4g3rk2q-an.a.run.app | OAuth issuer/audience |
| AUTH_DISABLED | **false** | 本番認証有効 |
| IP_RESTRICTION_ENABLED | false | Cloud Armor 移行予定 |
| USE_FIRESTORE_USER_STORE | **false** | 次セッションで true に変更予定 |

---

## MVP 実装状況

| フェーズ | 内容 | 状態 |
|---------|------|------|
| Phase 1〜11 | コア基盤〜メモ機能統一 | 完了 |
| Phase 12A | Core + Shell アーキテクチャ | 完了 |
| Phase 12B | HTTP Shell + Dockerfile | 完了 |
| Phase 12C | GCP インフラ + デプロイ | 完了 |
| Phase 12D | 接続テスト + デモ | 完了（社長接続成功） |
| Phase 12E | OAuth 2.1 実装 | 完了（Cowork 接続成功） |
| Phase 12F1 | CORS ホワイトリスト | 完了 |
| Phase 12F2 | Cloud Armor IP 制限 | 未着手 |
| Phase 12G | CRUD 操作 | **完了（デプロイ済み・実接続テスト済み）** |

---

## デプロイ環境

| サービス | 状態 | URL/識別子 |
|---------|------|-----------|
| Cloud Run (Worker) | デプロイ済み | `hr-worker` |
| Cloud Run (API) | デプロイ済み | `hr-api` |
| Cloud Run (Web) | デプロイ済み | `hr-web` |
| Cloud Run (MCP) | **CRUD 本番デプロイ済み** | `mcp-smarthr` (rev 00012, min=1/max=1) |

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

# 現在の Cloud Run 状態確認
gcloud run services describe mcp-smarthr --region=asia-northeast1 --format="yaml(spec.template.spec.containers[0].env)"

# OAuth エンドポイント動作確認
curl -s https://mcp-smarthr-1021020088552.asia-northeast1.run.app/health

# 次のタスク:
# 1. チームプラン カスタムコネクタ有効化（社長操作）
# 2. USE_FIRESTORE_USER_STORE=true + ユーザー登録
# 3. Cowork で CRUD 動作確認
```
