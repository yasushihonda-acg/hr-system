# HR-AI Agent — Session Handoff

**最終更新**: 2026-04-13（セッション終了時点）
**ブランチ**: `main`
**main 最新**: `78eb40c` — feat: OAuth 2.1 Authorization Server + セキュリティ強化（Phase E+F1） (#421)

---

## 現在のフェーズ

**Phase 12 — SmartHR MCP サーバー構築（Phase E+F1 完了・OAuth 本番稼働中）**

### 今セッションの成果

1. **Phase E: OAuth 2.1 Authorization Server**（PR #421）
   - E0: ツールアノテーション追加（readOnlyHint, idempotentHint）+ 監査ログ denied/error 分離 + SDK ピン（1.26.0）
   - E1: MCP 仕様準拠 OAuth AS 実装
     - `/.well-known/oauth-protected-resource`（RFC 9728）
     - `/.well-known/oauth-authorization-server`（RFC 8414）
     - `/authorize` → Google OIDC 委譲（PKCE S256 必須）
     - `/oauth/callback` → 認可コード発行
     - `/token` → JWT 交換（一回限り、PKCE 検証）
     - `/register` → Dynamic Client Registration（RFC 7591）
   - E2: Firestore UserStore 実装（`mcp-users` コレクション、`USE_FIRESTORE_USER_STORE=true` で有効化）
   - E3: JWT 検証モード追加 + AUTH_DISABLED=false（本番認証有効）
   - E4: Cloud Run デプロイ + Cowork から OAuth ログイン → ツール実行成功

2. **Phase F1: CORS ホワイトリスト化**（PR #421）
   - `origin: "*"` → 許可オリジンリスト（claude.ai, Cowork, 自サーバー）

3. **レビュー指摘対応**（Codex セカンドオピニオン + 4 エージェント並列レビュー）
   - fail-open → fail-closed（UserStore null 時はアクセス拒否）
   - ドメイン漏洩修正（エラーレスポンスから内部情報除去）
   - clientState 型安全性（`Record<string, unknown>` キャスト → 型定義）
   - /register サイズ上限追加（DoS 防止）
   - /token の redirect_uri を必須に（OAuth 2.1 準拠）
   - セキュリティイベントログ追加（PKCE, client_id, redirect_uri 失敗）

4. **Codex セカンドオピニオンによる設計判断**
   - 自前 AS vs マネージド AS → 自前（10-30名の社内ツールに Auth0 は過剰）
   - CRUD を OAuth と分離 → Phase G は E+F 安定後に着手
   - DELETE 初期スコープ外 → SmartHR の退職処理は PATCH（resigned_at）が正規フロー
   - IP 制限 → Cloud Armor に移行（アプリ内 XFF パースは脆弱）

### マージ済み PR

| PR | 内容 | 状態 |
|----|------|------|
| #421 | OAuth 2.1 AS + セキュリティ強化（Phase E+F1） | マージ済 |

---

## 次のアクション

### 即時（次セッション）

1. **チームプラン カスタムコネクタ有効化**
   - 組織オーナー（社長）がカスタムコネクタ追加を許可
   - チームメンバーの接続テスト

2. **Firestore UserStore 有効化**
   - `USE_FIRESTORE_USER_STORE=true` に変更
   - 初期ユーザー登録（admin: 社長, readonly: 他メンバー）
   - 現在はフォールバック（全ドメインユーザー readonly）で運用中

### Phase F2: Cloud Armor IP 制限
- Cloud Armor ポリシーで Anthropic IP 範囲（160.79.104.0/21）を許可
- アプリ内の XFF パースコード削除
- IP_RESTRICTION_ENABLED 環境変数廃止

### Phase G: CRUD 操作（E+F 安定後）
- G1: SmartHR Client に PATCH/POST メソッド追加（DELETE なし）
- G2: 2 フェーズ書き込み（prepare_* → confirm_*）
- G3: フィールド許可リスト + 1 操作 = 1 従業員制限
- G4: admin 限定 RBAC + 監査ログ

### 既存 Issues
- #407: Phase 2: Anthropic HR Plugin 導入
- #408: Phase 3: 本番 AI エージェント + 実験 UI

---

## 重要な設計判断（確定済み + 今セッション追加）

| 判断 | 決定 | 理由 |
|------|------|------|
| OAuth AS | 自前（Google OIDC 委譲） | 10-30名の社内ツール。Auth0 は過剰な依存・コスト |
| OAuth 方式 | auth-code + PKCE のみ、リフレッシュトークンなし | Codex セカンドオピニオン: 意図的に狭い AS |
| JWT | HS256, 1時間有効, aud/iss バインド | 短寿命でセキュリティ確保 |
| fail-closed | UserStore null → アクセス拒否 | HR データ（PII）保護。fail-open は禁止 |
| CRUD 方針 | PATCH のみ（PUT 禁止）、DELETE スコープ外 | SmartHR API のフィールド消失リスク回避 |
| IP 制限 | Cloud Armor に移行予定 | アプリ内 XFF パースは脆弱（Codex 指摘） |
| インスタンス | min=1, max=1 | インメモリ OAuth 状態保持 + コールドスタート防止 |
| CORS | ホワイトリスト | claude.ai, Cowork, 自サーバーのみ |

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
| Phase 12E | OAuth 2.1 実装 | **完了（Cowork 接続成功）** |
| Phase 12F1 | CORS ホワイトリスト | **完了** |
| Phase 12F2 | Cloud Armor IP 制限 | 未着手 |
| Phase 12G | CRUD 操作 | 未着手（E+F 安定後） |

---

## デプロイ環境

| サービス | 状態 | URL/識別子 |
|---------|------|-----------|
| Cloud Run (Worker) | デプロイ済み | `hr-worker` |
| Cloud Run (API) | デプロイ済み | `hr-api` |
| Cloud Run (Web) | デプロイ済み | `hr-web` |
| Cloud Run (MCP) | **OAuth 本番稼働中** | `mcp-smarthr` (rev 00010, min=1/max=1) |

---

## テスト状況

| パッケージ | テスト数 | 状態 |
|-----------|---------|------|
| packages/mcp-smarthr | **88** | ✅ 全PASS |
| apps/api | 22+ | ✅ |
| apps/worker | 80 | ✅ |
| apps/web | 207 | ✅ |

---

## 再開手順

```bash
cd /Users/yyyhhh/Projects/ACG/hr-system
git checkout main && git pull

# 現在の Cloud Run 状態確認
gcloud run services describe mcp-smarthr --region=asia-northeast1 --format="yaml(spec.template.spec.containers[0].env)"

# OAuth エンドポイント動作確認
curl -s https://mcp-smarthr-1021020088552.asia-northeast1.run.app/.well-known/oauth-protected-resource | python3 -m json.tool

# 次のタスク:
# 1. チームプラン カスタムコネクタ有効化
# 2. USE_FIRESTORE_USER_STORE=true + ユーザー登録
# 3. Phase F2: Cloud Armor IP 制限
```
