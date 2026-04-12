# HR-AI Agent — Session Handoff

**最終更新**: 2026-04-12（セッション終了時点）
**ブランチ**: `main`
**main 最新**: `7abe1ea` — feat: SmartHR MCP HTTP Shell + Dockerfile（Phase B）(#414)

---

## 現在のフェーズ

**Phase 12 進行中 — SmartHR MCP サーバー構築**

### 今セッションの成果

1. **PR #412 レビュー + マージ**（Phase A）
   - 6エージェント並列レビュー実施（code-reviewer, test-analyzer, failure-hunter, type-analyzer, comment-analyzer, code-simplifier）
   - Critical 4件 + Important 2件の指摘を修正（PR #413）
   - 修正内容: 空catch除去、JSON二重シリアライズ解消、PII マスキング統合、AuthContext ファクトリ、fail-closed、TOOL_PERMISSIONS 型安全化
   - テスト: 62→63件

2. **Phase B 実装 + マージ**（PR #414）
   - HTTP Shell: Hono + MCP Streamable HTTP + Google OAuth ID トークン検証
   - Dockerfile: multi-stage build（node:22-slim）
   - serve.ts: HTTP エントリポイント（Cloud Run 用）
   - テスト: 63→69件（HTTP Shell 6件追加）

### マージ済み PR

| PR | 内容 | 状態 |
|----|------|------|
| #412 | Phase A: Core + Shell アーキテクチャ | マージ済 |
| #413 | Phase A レビュー指摘修正 | マージ済 |
| #414 | Phase B: HTTP Shell + Dockerfile | マージ済 |

---

## 次のアクション（WBS Phase C-D）

### Phase C: GCP インフラ（未着手）← 次セッションで着手
- C1: Secret Manager にトークン登録（SMARTHR_API_KEY, SMARTHR_TENANT_ID, GOOGLE_CLIENT_ID）
- C2: サービスアカウント作成 + IAM 設定（Secret Accessor, Cloud Run 用）
- C3: Cloud Run デプロイ（`mcp-smarthr`, asia-northeast1）
- 品質ゲート: `/codex review` (security)

### Phase D: 接続テスト + 検証（未着手）
- D1: Claude Code stdio 接続テスト
- D2: Claude Desktop stdio 接続テスト
- D3: claude.ai カスタムコネクタ登録 + テスト
- D4: E2E 全 AC 検証
- 品質ゲート: `/simplify` + `/safe-refactor` + Evaluator 分離 + `/review-pr`

---

## 重要な設計判断（確定済み）

| 判断 | 決定 | 理由 |
|------|------|------|
| SmartHR API MCP | 公式・OSS なし → ACG 専用で自作 | 給与 PII の安全性、最小権限 |
| アーキテクチャ | Core + Shell パターン | Claude Code / claude.ai / 自社アプリ全対応 |
| 接続パターン | パブリック Cloud Run + アプリ内 OAuth | IAP は claude.ai コネクタと共存不可 |
| 認証 | 4層（トランスポート→ドメイン→許可リスト→ツール権限） | SmartHR API トークンがスコープなし |
| HTTP フレームワーク | Hono + @modelcontextprotocol/hono | MCP SDK 公式サポート、既存 apps/ と統一 |
| OAuth 検証 | google-auth-library | Google ID トークン直接検証 |
| セッション管理 | ステートレス | Cloud Run スケーリングとの相性 |
| 監査ログ | Cloud Logging + Firestore 両方 | 7年保持 + 運用性 |
| PII フィルタ | pii-filter.ts に統合（maskPII 1系統） | レビュー指摘 C3 対応 |
| AuthContext | ファクトリ関数 createAuthContext で email/domain 整合保証 | レビュー指摘 C4 対応 |
| TOOL_PERMISSIONS | Record<ToolName, Role> で型安全化 | レビュー指摘 I5 対応 |

---

## MVP 実装状況

| フェーズ | 内容 | 状態 |
|---------|------|------|
| Phase 1〜5 | コア基盤（給与計算・Chat連携・LINE連携・認証・CI/CD） | 完了 |
| Phase 6 | Inbox（受信箱）+ ワークフロー管理 | 完了 |
| Phase 7 | UI再設計（3ペイン Inbox・タスクサイドパネル・Admin 統合） | 完了 |
| Phase 8 | タスク優先度・手動タスク・セキュリティ強化・パフォーマンス改善 | 完了 |
| Phase 9 | 担当者・期限インライン編集・手動タスクUI改善・AI判定パネル削除 | 完了 |
| Phase 10 | タスクテーブルビュー拡充 | 完了 |
| Phase 11 | 受信箱・タスクボードのメモ機能統一 | 完了 |
| Phase 12 | SmartHR MCP サーバー構築 | **Phase A+B 完了、C-D 未着手** |

---

## オープン GitHub Issues

| # | タイトル | ラベル |
|---|---------|--------|
| #408 | Phase 3: 本番AIエージェント + 実験UI（/agent-lab） | enhancement |
| #407 | Phase 2: Anthropic HR Plugin 導入（開発用ツール） | enhancement |

---

## デプロイ環境

| サービス | 状態 | URL/識別子 |
|---------|------|-----------|
| Cloud Run (Worker) | デプロイ済み | `hr-worker` (asia-northeast1) |
| Cloud Run (API) | デプロイ済み | `hr-api` (asia-northeast1) |
| Cloud Run (Web) | デプロイ済み | `hr-web` (asia-northeast1) |
| Cloud Run (MCP) | **未デプロイ**（Phase C） | `mcp-smarthr` (asia-northeast1) |

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

# main ブランチで最新状態
git checkout main && git pull

# Phase C 着手
# → docs/plans/smarthr-mcp-server-impl-plan.md の Phase C セクションを参照
# → C1: Secret Manager、C2: SA+IAM、C3: Cloud Run デプロイ
# → GCP プロジェクト: hr-system-487809, リージョン: asia-northeast1

# 参考: 実装計画
cat docs/plans/smarthr-mcp-server-impl-plan.md

# 参考: Dockerfile
cat packages/mcp-smarthr/Dockerfile
```
