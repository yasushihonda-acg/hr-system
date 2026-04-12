# HR-AI Agent — Session Handoff

**最終更新**: 2026-04-12（セッション終了時点）
**ブランチ**: `main`
**main 最新**: `0ff736d` — fix: claude.ai からの接続で 406 エラーを修正 (#419)

---

## 現在のフェーズ

**Phase 12 — SmartHR MCP サーバー構築（Phase C 完了・デモ稼働中）**

### 今セッションの成果

1. **Phase C: GCP インフラ構築**（PR なし — gcloud CLI 操作）
   - C1: Secret Manager に `smarthr-api-key`, `smarthr-tenant-id` 登録（`GOOGLE_CLIENT_ID` は既存再利用）
   - C2: SA `mcp-smarthr@` 作成 + IAM 設定（Secret Accessor, Firestore User, Logging Writer）
   - C3: Cloud Run デプロイ（`mcp-smarthr`, asia-northeast1, `--allow-unauthenticated`）
   - Docker ビルド時の `--platform linux/amd64` 必須（Apple Silicon 環境）

2. **Phase D: 接続テスト + 検証**
   - D1 stdio テスト: initialize → tools/list（6ツール）→ list_employees（実データ2413件）→ PII フィルタ → RBAC 検証 全 PASS
   - D3 HTTP テスト: /health 200, 認証なし 401, 無効トークン 401 全 PASS
   - セキュリティレビュー: Critical 0, Important 3（既知の設計判断）

3. **デモ対応**（PR #416〜#419）
   - AUTH_DISABLED モード追加（claude.ai コネクタは Google OAuth 直接検証非対応）
   - Anthropic IP 制限追加（X-Forwarded-For が 0.0.0.0 になる問題あり → 一時無効化）
   - Accept ヘッダー補正（claude.ai が application/json のみ送信 → 406 修正）
   - ドキュメントページ追加（/docs、Mermaid.js + Tailwind CSS）

4. **社長デモ成功**
   - claude.ai（Team プラン）からカスタムコネクタ接続成功
   - Cowork（個人 Pro）からも接続確認済み
   - テスト利用開始

### マージ済み PR

| PR | 内容 | 状態 |
|----|------|------|
| #416 | AUTH_DISABLED デモモード追加 | マージ済 |
| #417 | Anthropic IP 制限追加 | マージ済 |
| #418 | ドキュメントページ (/docs) 追加 | マージ済 |
| #419 | claude.ai 406 エラー修正 | マージ済 |

---

## 次のアクション（社長 GO 後）

### Phase E: OAuth 2.0 実装（最優先）
- E1: MCP OAuth Authorization Server 実装（Google OAuth リダイレクト → トークン発行）
- E2: claude.ai コネクタの Advanced Settings で OAuth Client ID/Secret 設定
- E3: ユーザー特定（email）→ 監査ログに実名記録
- E4: admin/readonly ロール分け → get_pay_statements の admin 限定解除

### Phase F: セキュリティ強化
- F1: IP 制限修正（Cloud Run の X-Forwarded-For が 0.0.0.0 になる問題の調査・修正）
- F2: Firestore 許可リスト実装（serve.ts の httpUserStore を差し替え）
- F3: CORS 制限（`origin: "*"` → ホワイトリスト化）
- F4: AUTH_DISABLED=false に戻す

### 既存 Issues
- #407: Phase 2: Anthropic HR Plugin 導入
- #408: Phase 3: 本番 AI エージェント + 実験 UI

---

## 重要な設計判断（確定済み + 今セッション追加）

| 判断 | 決定 | 理由 |
|------|------|------|
| SmartHR API MCP | 公式・OSS なし → ACG 専用で自作 | 給与 PII の安全性、最小権限 |
| アーキテクチャ | Core + Shell パターン | Claude Code / claude.ai / 自社アプリ全対応 |
| 接続パターン | パブリック Cloud Run + アプリ内 OAuth | IAP は claude.ai コネクタと共存不可 |
| デモ認証 | AUTH_DISABLED=true（一時的） | claude.ai コネクタが Google ID トークン直接検証に非対応 |
| Accept ヘッダー | ミドルウェアで補正 | claude.ai (python-httpx) が片方のみ送信 → MCP SDK が 406 |
| IP 制限 | 実装済みだが一時無効 | X-Forwarded-For が 0.0.0.0 になる Cloud Run の挙動要調査 |
| ドキュメント | /docs エンドポイント（静的 HTML） | static/ に HTML、認証・IP 制限対象外 |

---

## Cloud Run 環境変数（現在の設定）

| 変数 | 値 | 備考 |
|------|-----|------|
| NODE_ENV | production | |
| ALLOWED_DOMAIN | aozora-cg.com | |
| SMARTHR_API_KEY | Secret Manager | smarthr-api-key:latest (v4) |
| SMARTHR_TENANT_ID | Secret Manager | smarthr-tenant-id:latest |
| GOOGLE_CLIENT_ID | Secret Manager | GOOGLE_CLIENT_ID:latest |
| AUTH_DISABLED | **true** | デモ用。GO 後に false に戻す |
| IP_RESTRICTION_ENABLED | **false** | X-Forwarded-For 問題で無効化中 |

---

## MVP 実装状況

| フェーズ | 内容 | 状態 |
|---------|------|------|
| Phase 1〜11 | コア基盤〜メモ機能統一 | 完了 |
| Phase 12A | Core + Shell アーキテクチャ | 完了 |
| Phase 12B | HTTP Shell + Dockerfile | 完了 |
| Phase 12C | GCP インフラ + デプロイ | 完了 |
| Phase 12D | 接続テスト + デモ | **完了（社長接続成功）** |
| Phase 12E | OAuth 2.0 実装 | 未着手（GO 後） |
| Phase 12F | セキュリティ強化 | 未着手（GO 後） |

---

## デプロイ環境

| サービス | 状態 | URL/識別子 |
|---------|------|-----------|
| Cloud Run (Worker) | デプロイ済み | `hr-worker` |
| Cloud Run (API) | デプロイ済み | `hr-api` |
| Cloud Run (Web) | デプロイ済み | `hr-web` |
| Cloud Run (MCP) | **デプロイ済み** | `mcp-smarthr` (rev 00007) |

---

## テスト状況

| パッケージ | テスト数 | 状態 |
|-----------|---------|------|
| packages/mcp-smarthr | **69** | ✅ 全PASS |
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

# 社長 GO 後 → Phase E (OAuth) に着手
# 参考: docs/plans/smarthr-mcp-server-impl-plan.md

# ドキュメントページ確認
# https://mcp-smarthr-1021020088552.asia-northeast1.run.app/docs
```
