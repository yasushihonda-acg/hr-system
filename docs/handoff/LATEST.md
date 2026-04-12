# HR-AI Agent — Session Handoff

**最終更新**: 2026-04-12（セッション終了時点）
**ブランチ**: `feature/smarthr-mcp-core-security`（PR #412 レビュー待ち）
**main 最新**: `f562e41` — docs: ハンドオフ更新（Phase 12 進行中）

---

## 現在のフェーズ

**Phase 12 進行中 — SmartHR MCP サーバー構築**

### 今セッションの成果

SmartHR MCP サーバーの **Core + Shell アーキテクチャ（Phase A）** を完成。

1. **徹底調査**（6並列エージェント）
   - SmartHR API 公式ドキュメント、ベストプラクティス、MCP 構築 BP、SmartHR 社 MCP 活用事例、既存 OSS 分析、セキュリティ設計
   - 結果: `docs/research/smarthr-mcp-server-research.md`

2. **実装計画 v2**
   - Core + Shell パターン、4層認証、Phase A-D の WBS
   - 結果: `docs/plans/smarthr-mcp-server-impl-plan.md`

3. **Phase A 実装**（Core 基盤強化）
   - A1: Core ディレクトリ構造リファクタ
   - A2: レート制限（100ms間隔 + x-rate-limit監視 + 429 Exponential Backoff）
   - A3: PII フィルタ（ロール別フィールド除去）
   - A4: 監査ログ（Cloud Logging + Firestore AuditLog DI）
   - A5: 4層認証（トランスポート→ドメイン→許可リスト→ツール権限）
   - A6: ミドルウェアパイプライン統合（Codex 設計レビュー H1-H4, M1 修正）

4. **品質**
   - テスト: 62件全PASS / lint: PASS / typecheck: PASS
   - Codex セカンドオピニオン完了（指摘5件全修正）

### PR #412（レビュー待ち）

- `feature/smarthr-mcp-core-security` → `main`
- +2437行 / 17ファイル
- **次セッションで `/review-pr` 実施後マージ**

---

## 次のアクション（WBS Phase B-D）

### Phase B: Shell 実装（未着手）
- B1: stdio Shell（既存 index.ts リファクタ済み、動作確認のみ）
- B2: HTTP Shell（Hono + Streamable HTTP + Google OAuth）← 最大の実装タスク
- B3: Dockerfile + Cloud Run デプロイ設定

### Phase C: GCP インフラ（未着手）
- C1: Secret Manager にトークン登録
- C2: サービスアカウント + IAM 設定
- C3: Cloud Run デプロイ

### Phase D: 接続テスト + 検証（未着手）
- D1: Claude Code stdio 接続テスト
- D2: Claude Desktop stdio 接続テスト
- D3: claude.ai カスタムコネクタ登録 + テスト
- D4: E2E 全 AC 検証

### 品質ゲート
- Phase B 完了後: lint + typecheck + test
- Phase C 完了後: `/codex review` (security)
- Phase D 完了後: `/simplify` + `/safe-refactor` + Evaluator 分離 + `/review-pr`

---

## 重要な設計判断（確定済み）

| 判断 | 決定 | 理由 |
|------|------|------|
| SmartHR API MCP | 公式・OSS なし → ACG 専用で自作 | 給与 PII の安全性、最小権限 |
| アーキテクチャ | Core + Shell パターン | Claude Code / claude.ai / 自社アプリ全対応 |
| 接続パターン | パブリック Cloud Run + アプリ内 OAuth | IAP は claude.ai コネクタと共存不可 |
| 認証 | 4層（トランスポート→ドメイン→許可リスト→ツール権限） | SmartHR API トークンがスコープなし |
| 監査ログ | Cloud Logging + Firestore 両方 | 7年保持 + 運用性 |
| PII フィルタ | readonly: 個人情報+custom_fields除外 / admin: my_number除外 | Codex レビュー M1 対応 |
| 未登録ツール | default deny | Codex レビュー H3 対応 |
| stdio 未登録ユーザー | readonly（admin にしない） | Codex レビュー H2 対応 |

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
| Phase 12 | SmartHR MCP サーバー構築 | **Phase A 完了、B-D 未着手** |

---

## オープン GitHub Issues

| # | タイトル | ラベル |
|---|---------|--------|
| #412 | feat: SmartHR MCP サーバー Core + Shell アーキテクチャ（Phase A） | PR |
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
| packages/mcp-smarthr | **62** | ✅ 全PASS |
| apps/api | 22+ | ✅ |
| apps/worker | 80 | ✅ |
| apps/web | 207 | ✅ |

---

## 再開手順

```bash
cd /Users/yyyhhh/Projects/ACG/hr-system

# PR #412 のレビュー・マージ
gh pr view 412
# → /review-pr 実行後にマージ

# Phase B 着手
git checkout feature/smarthr-mcp-core-security  # or main after merge
# → docs/plans/smarthr-mcp-server-impl-plan.md の Phase B から再開
```
