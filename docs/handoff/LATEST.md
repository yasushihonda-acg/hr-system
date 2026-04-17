# HR-AI Agent — Session Handoff

**最終更新**: 2026-04-17（外部 readonly 例外許可機能 実装セッション）
**ブランチ**: `feat/external-readonly-allowlist`（**未マージ、作業継続中**）
**main 最新**: `31a7c3f` — docs: CLAUDE.md に Operational Status セクション追加 (#437)

---

## 現在のフェーズ

**Phase 13 — SmartHR MCP 外部 readonly 例外ユーザー許可（実装完了、デプロイ待機）**

別テナント `y@lend.aozora-cg.com` を readonly で恒久許可する機能を追加中。
Codex `/codex plan` の案 A'（`EXTERNAL_READONLY_EMAIL_ALLOWLIST` 環境変数 + Firestore `mcp-users` の二重承認方式）を採用。

---

## 今セッションの成果

### マージ済み PR（本セッション）

| PR | 内容 | 状態 |
|----|------|------|
| #437 | CLAUDE.md に Operational Status セクション追加 | ✅ マージ済み（`31a7c3f`） |

### 進行中 PR

| PR | 内容 | 状態 |
|----|------|------|
| **#438** | **SmartHR MCP に外部 readonly 例外メール許可機能を追加** | 🟡 **OPEN、レビュー完了、マージ判断待ち** |

### PR #438 の内容

**実装内容:**
- `isAllowedIdentity` 共通関数（Layer 2 判定、ドメイン優先、email 小文字正規化）
- `Authorizer` に `externalAllowlist` 対応 + 外部ユーザー readonly 強制ガード
- `EXTERNAL_READONLY_EMAIL_ALLOWLIST` 環境変数（ワイルドカード拒否、重複排除）
- OAuth `/authorize` の `hd` パラメータ条件付き送信（外部例外時は省略）
- OAuth `/token` で外部 readonly 不変条件を JWT 発行前に再検証
- 監査ログに `allowedBy` タグ（`domain` / `external_email_exception` / `denied`）
- stdio shell でも externalAllowlist を配線
- Firestore `UserDocument` に運用メタデータ（`external`, `approvedBy`, `approvedAt`, `reason`）
- `seed-users.ts` に `y@lend.aozora-cg.com` を readonly + external=true で追加
- `/docs` `/guide` 更新

**変更規模:** 14 ファイル / +768/-21 行（2 コミット: `4a7e70e`, `f474769`）

**テスト:** 98 → 135（+37 件、全 PASS）

### 実施した品質ゲート

| ゲート | 結果 | 対応 |
|--------|------|------|
| `/codex plan` | 案 A' 推奨、追加安全策提示 | ✅ 採用 |
| `/codex review` | Medium 2 件指摘（`/token` readonly 再検証、stdio 配線） | ✅ `f474769` で修正 |
| Evaluator | AC 10/11 PASS + 1 軽微な構造差（logging path） | ✅ 許容 |
| `/review-pr`（6 エージェント並列） | Critical 4 件、Important/Suggestion 多数 | 🟡 **対応範囲未決** |

---

## WBS 進捗（T1-T14）

| ID | タスク | 状態 |
|----|-------|------|
| T1 | `isAllowedIdentity` 共通関数 | ✅ 完了 |
| T2 | Authorizer 外部例外対応 | ✅ 完了 |
| T3 | OAuth callback ドメイン検証を共通関数化 | ✅ 完了 |
| T4 | OAuth `/authorize` の hd 条件付き送信 | ✅ 完了 |
| T5 | 環境変数パースと起動時ガード | ✅ 完了 |
| T6 | 外部例外ユーザー readonly 強制ガード | ✅ 完了 |
| T7 | 監査ログ `allowedBy` タグ | ✅ 完了 |
| T8 | FirestoreUserStore 型拡張 | ✅ 完了 |
| T9 | ユニットテスト追加 | ✅ 完了（135/135 PASS） |
| T10 | Firestore `mcp-users` に y@lend 登録 | ⏳ **未実施** |
| T11 | 配信ドキュメント更新 | ✅ 完了 |
| T12 | Cloud Run デプロイ + 環境変数更新 | ⏳ **未実施** |
| T13 | 実機検証（y@lend 本人に依頼） | ⏳ **未実施** |
| T14 | ハンドオフ更新 | ✅ 本ドキュメントで完了 |

**進捗: 11/14（79%）** — 実装・テスト・ドキュメントは完了、残りはデプロイ・検証フェーズ

---

## 次のアクション

### 即時（次セッション冒頭、必須）

```bash
cd /Users/yyyhhh/Projects/ACG/hr-system
git fetch origin
git checkout feat/external-readonly-allowlist
git pull
pwd  # /Users/yyyhhh/Projects/ACG/hr-system
```

**注意事項:** 今セッション中にローカルブランチが `main` に切り替わる事象が発生（原因不明、リモート側に影響なし、手動で `feat/external-readonly-allowlist` に復帰）。`/review-pr` の 6 並列エージェント実行中の副作用の可能性あり。次セッションでは **`git checkout` 後に `git log --oneline -3` で `f474769` を確認**すること。

### 次の意思決定（優先順）

**1. `/review-pr` 指摘への対応範囲（A/B/C 判断）**

/review-pr 結果の Critical 相当:
- **silent-failure C1**: `server.ts:113-115` 空 catch（監査ログ失敗を隠蔽）
- **silent-failure C4**: `serve.ts` fallback UserStore がデフォルト fail-open
- **pr-test-analyzer C1**: OAuth `/token` 外部例外ガードの統合テスト無し
- **pr-test-analyzer C2**: OAuth callback Layer 2 統一の統合テスト無し
- **comment-analyzer C1**: Mermaid 図 `hd == aozora-cg.com` が外部例外経路を反映していない
- **code-simplifier C1**: `authorizeStdio` の email 正規化を `isAllowedIdentity` に集約推奨

**選択肢:**
- **A. 本 PR で polish**（+30-60 分）: silent-failure C1 / comment C1 / code-simplifier C1 を修正してからマージ
- **B. 現状でマージ → T10-T13 進行**（推奨、WBS 優先）: 上記指摘は follow-up issue 化
- **C. 追加 codex review** でさらに精査

**前回の推奨: B**（実機検証 T13 が真の最終ゲートであり、polish 系の指摘は運用後で十分）

**2. T10-T13 実行順序**

マージ後のデプロイ手順:
```bash
# T10: Firestore に y@lend.aozora-cg.com を登録
npx tsx packages/mcp-smarthr/scripts/seed-users.ts

# T12: Cloud Run デプロイ + 環境変数追加
# EXTERNAL_READONLY_EMAIL_ALLOWLIST=y@lend.aozora-cg.com を Cloud Run サービスに追加
# （詳細コマンドは次セッションで調整）

# T13: y@lend.aozora-cg.com 本人に接続試行を依頼
# - claude.ai Pro カスタムコネクタ登録
# - Claude Desktop / Claude Code CLI リモート MCP 接続
# - read ツールが通る / write/pay_statements が 403 / hd 条件送信の挙動確認
```

---

## 登録ユーザー（Firestore `mcp-users`）

| ロール | 権限 | アカウント |
|--------|------|-----------|
| **admin** | 閲覧 + 更新 + 登録 + 給与明細 | kosuke.omure, tomohiro.arikawa, makoto.tokunaga, yasushi.honda |
| **readonly** | 閲覧のみ | ryota.yagi, gen.ichihara, rika.komatsu, shoma.horinouchi, tomoko.hommura, yuka.yoshimura |
| **readonly（外部例外、T10 実施後に追加予定）** | 閲覧のみ | **y@lend.aozora-cg.com** ← 別テナント、恒久許可 |

---

## 外部 readonly 例外の運用方針

- **狭い恒久例外**として扱う（1 名限定）
- **二重承認**: 環境変数 `EXTERNAL_READONLY_EMAIL_ALLOWLIST` + Firestore `mcp-users` 両方必須
- **readonly コード強制**: Authorizer と OAuth `/token` で `isExternalReadonlyViolation` を実施（admin/write/pay_statements permission 付与時に 403）
- **revoke 手順**:
  - 緊急: Firestore `enabled: false` で即時停止
  - 完全: env 変数削除 + Cloud Run 再デプロイ
- **増殖ガード**: 2 人目が出た場合は多テナント UserStore に再設計（本方式の継ぎ足しは禁止）

---

## 重要な設計判断（本セッション追加）

| 判断 | 決定 | 理由 |
|------|------|------|
| 外部ユーザー許可方式 | 案 A'（env + Firestore 二重承認） | 案 B（bypassDomainCheck フラグ）は Layer 2/3 独立性を損なう（Codex 指摘） |
| 外部ユーザーの権限 | readonly コード強制 | Firestore 誤設定で write 付与されても deny する最終防衛線 |
| `hd` パラメータ | 外部例外あり時は省略 | 外部テナントユーザーの認可画面到達を保証、セキュリティは callback 側で担保 |
| JWT 寿命 | 既存のまま（差別化なし） | 信頼レベルがドメインユーザーと同等なため |
| SmartHR API key 分離 | 不要 | 同上、Layer 4 で十分 |

---

## 既存 PR・Issue

| 番号 | 内容 | 状態 |
|------|------|------|
| #437 | CLAUDE.md Operational Status | ✅ マージ済 |
| **#438** | **外部 readonly 例外** | 🟡 **OPEN、本セッション継続作業** |
| #407 | Phase 2: Anthropic HR Plugin 導入 | 積み残し |
| #408 | Phase 3: 本番 AI エージェント + 実験 UI | 積み残し |

---

## MCP ツール一覧（8ツール、変更なし）

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

## Cloud Run 環境変数

| 変数 | 現状値 | PR #438 マージ後の追加値 |
|------|--------|------------------------|
| AUTH_DISABLED | false | 変更なし |
| USE_FIRESTORE_USER_STORE | true | 変更なし |
| IP_RESTRICTION_ENABLED | false | 変更なし |
| **EXTERNAL_READONLY_EMAIL_ALLOWLIST** | 未設定 | **`y@lend.aozora-cg.com` を追加予定（T12）** |

---

## デプロイ環境

| サービス | 状態 |
|---------|------|
| Cloud Run (MCP) | rev 00020 稼働中（PR #438 マージ後に新 rev 予定） |
| Cloud Run (Worker) | デプロイ済み |
| Cloud Run (API) | デプロイ済み |
| Cloud Run (Web) | デプロイ済み |

---

## テスト状況

| パッケージ | テスト数 | 状態 |
|-----------|---------|------|
| packages/mcp-smarthr | **135**（本セッションで +37） | 全 PASS |
| apps/api | 22+ | 全 PASS |
| apps/worker | 80 | 全 PASS |
| apps/web | 207 | 全 PASS |

---

## 再開手順

```bash
# 1. 環境確認
cd /Users/yyyhhh/Projects/ACG/hr-system
git fetch origin
git checkout feat/external-readonly-allowlist
git log --oneline -3  # f474769 が HEAD であること確認

# 2. PR 状態確認
gh pr view 438 --json state,mergeable

# 3. Cloud Run 現状確認
curl -s https://mcp-smarthr-1021020088552.asia-northeast1.run.app/health

# 4. 次の判断（上記「次の意思決定」参照）:
#    - /review-pr 指摘への対応範囲（A/B/C 判断）
#    - マージ → T10 → T12 → T13 の実行
```

---

## 参考資料

- PR #438: https://github.com/yasushihonda-acg/hr-system/pull/438
- Codex plan レビュー: 案 A'（EXTERNAL_READONLY_EMAIL_ALLOWLIST + 二重承認）
- Codex review: Medium 2 件（`f474769` で対応済み）
- Evaluator: AC 10/11 PASS（logging path 構造差 1 件は機能影響なし）
- /review-pr: 6 エージェント並列、Critical 4 件（詳細は前セッション会話ログ）
