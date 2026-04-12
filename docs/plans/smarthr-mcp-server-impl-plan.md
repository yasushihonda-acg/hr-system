# SmartHR MCP サーバー内製化 — 実装計画 v2

> 作成日: 2026-04-12
> 更新日: 2026-04-12（Core + Shell パターンに全面改訂）
> ステータス: 承認待ち
> 調査レポート: [docs/research/smarthr-mcp-server-research.md](../research/smarthr-mcp-server-research.md)

---

## Phase 1: 要件の明確化

### 1.1 ゴール

1つの MCP サーバーで、以下の全クライアントから `@aozora-cg.com` 内部ユーザー限定で SmartHR の人事データを安全に参照できるようにする。

| クライアント | トランスポート | 認証方式 |
|-------------|---------------|---------|
| Claude Code | stdio（ローカル） | 環境変数 |
| Claude Desktop | stdio（ローカル） | 環境変数 |
| claude.ai / Cowork | Streamable HTTP（リモート） | OAuth 2.0（Google） |
| 自社アプリ / AI エージェント | Streamable HTTP or SDK 直接 | サービスアカウント or OAuth |

### 1.2 成功の定義

1. Claude Code から stdio で SmartHR 従業員情報を参照できる
2. claude.ai のカスタムコネクタから SmartHR 従業員情報を参照できる
3. `@aozora-cg.com` ドメイン以外からのアクセスが拒否される
4. ドメイン内でもアカウント単位でアクセス制御できる（許可リスト）
5. 給与情報は admin ロールのみアクセス可能
6. 全ツール呼び出しが監査ログに記録される

### 1.3 スコープ

**含める:**
- Core + Shell アーキテクチャ（stdio / Streamable HTTP 両対応）
- 読み取り専用ツール 6 種（既存の list/get/search employees, pay_statements, departments, positions）
- 4 層認証（トランスポート → ドメイン → 許可リスト → ツール権限）
- レート制限対策（スロットリング + x-rate-limit ヘッダー監視 + 429 リトライ）
- 監査ログ（Cloud Logging + Firestore AuditLog 7 年保持）
- PII フィルタリング（ロール別フィールド制御）
- Cloud Run デプロイ（パブリック + アプリ内 OAuth 認証）
- claude.ai カスタムコネクタ登録

**スコープ外（将来拡張）:**
- 書き込み操作（従業員更新、部署変更等）
- Webhook 受信（リアルタイム同期）
- SmartHR Plus アプリストア公開
- 他テナントへの展開
- 専用 Web アプリ（チャット UI）

### 1.4 設計方針: Core + Shell パターン

```
packages/mcp-smarthr/
  src/
    core/                    ← ビジネスロジック（トランスポート非依存）
      smarthr-client.ts       SmartHR API クライアント（レート制限内蔵）
      tools.ts                MCP ツール定義（6 ツール）
      types.ts                型定義
      middleware/
        auth.ts               4 層認証（ドメイン → 許可リスト → ロール → ツール権限）
        audit-logger.ts       監査ログ（Cloud Logging + Firestore）
        pii-filter.ts         ロール別 PII フィルタ
      lib/
        rate-limiter.ts       トークンバケット式レート制限

    shells/                  ← トランスポート層（差し替え可能）
      stdio.ts                Claude Code / Desktop 用
      http.ts                 claude.ai / Cowork / 自社アプリ用 (Hono + OAuth)

    index.ts                  stdio エントリポイント
    serve.ts                  HTTP エントリポイント（Cloud Run 用）
```

**利用パターン:**
- `pnpm start` → stdio モード（Claude Code / Desktop）
- `pnpm serve` → HTTP モード（Cloud Run → claude.ai / Cowork / 自社アプリ）
- `import { tools } from '@hr-system/mcp-smarthr/core'` → SDK 直接利用（自社アプリ内蔵）

---

## Phase 2: タスク分解

### 2.1 全体 WBS

```
Phase A: Core 基盤強化（既存コードの改善 + セキュリティ層追加）
  A1: Core ディレクトリ構造にリファクタリング
  A2: SmartHR Client にレート制限を追加
  A3: PII フィルタリング層を追加
  A4: 監査ログモジュールを作成
  A5: 4 層認証モジュールを作成
  ── テスト全 PASS 確認 ──
  ★ /codex review: Core 設計レビュー

Phase B: Shell 実装（stdio + HTTP 両対応）
  B1: stdio Shell（既存 index.ts のリファクタ） → A1 に依存
  B2: HTTP Shell (Hono + Streamable HTTP + OAuth) → A1 に依存
  B3: Dockerfile + Cloud Run デプロイ設定 → B2 に依存
  ── lint + typecheck + test 全 PASS ──

Phase C: GCP インフラ + デプロイ
  C1: Secret Manager にトークン登録（並列可）
  C2: サービスアカウント + IAM 設定（並列可）
  C3: Cloud Run デプロイ → B3, C1, C2 に依存
  ★ /codex review: セキュリティレビュー

Phase D: 接続テスト + 検証
  D1: Claude Code stdio 接続テスト → A1, B1 に依存（Phase A完了後即テスト可能）
  D2: Claude Desktop stdio 接続テスト → D1 と並列
  D3: claude.ai カスタムコネクタ登録 + 接続テスト → C3 に依存
  D4: E2E 検証（全 AC 確認） → D1, D3 に依存
  ── /simplify + /safe-refactor ──
  ★ /review-pr: 最終 PR レビュー
```

### 2.2 依存関係図

```
A1 ──┬→ A2 ─┐
     ├→ A3 ─┤
     ├→ A4 ─┼→ B1 → D1 (stdio テスト、早期検証)
     └→ A5 ─┤        D2
             │
             └→ B2 → B3 ─┐
                          ├→ C3 → D3 → D4
C1 ───────────────────────┤
C2 ───────────────────────┘
```

**ポイント:** D1（Claude Code stdio テスト）は Phase B1 完了後に即実行可能。Cloud Run デプロイを待たずに Core の動作確認ができる。

### 2.3 各タスクの詳細

| タスク | 概要 | 影響ファイル | 規模 | 並列 |
|--------|------|-------------|------|------|
| **A1** | Core ディレクトリ構造リファクタ（既存ファイルを core/ に移動） | 全既存ファイル | 小 | - |
| **A2** | レート制限（100ms間隔 + x-rate-limit監視 + 429リトライ + Exponential Backoff） | `core/smarthr-client.ts`, `core/lib/rate-limiter.ts`(新) | 中 | o |
| **A3** | PII フィルタ（ロール別フィールド除去、ログマスキング） | `core/middleware/pii-filter.ts`(新), `core/types.ts` | 小 | o |
| **A4** | 監査ログ（構造化ログ + Firestore AuditLog 7年保持） | `core/middleware/audit-logger.ts`(新) | 小 | o |
| **A5** | 4 層認証（トランスポート→ドメイン→許可リスト→ツール権限） | `core/middleware/auth.ts`(新), `core/tools.ts` | 中 | o |
| **B1** | stdio Shell（index.ts リファクタ、core を import） | `shells/stdio.ts`(新), `index.ts` | 小 | o |
| **B2** | HTTP Shell（Hono + Streamable HTTP + Google OAuth 検証） | `shells/http.ts`(新), `serve.ts`(新) | 大 | o |
| **B3** | Dockerfile + cloudbuild.yaml | `Dockerfile`(新), `.env.example`(新) | 小 | x |
| **C1** | Secret Manager: smarthr-api-key, smarthr-tenant-id 登録 | (gcloud CLI) | 小 | o |
| **C2** | SA 作成 + Secret Accessor + IAM 設定 | (gcloud CLI) | 小 | o |
| **C3** | Cloud Run デプロイ（パブリック + OAuth 認証） | (gcloud CLI) | 中 | x |
| **D1** | Claude Code stdio 接続テスト | - | 小 | o |
| **D2** | Claude Desktop stdio 接続テスト | - | 小 | o |
| **D3** | claude.ai カスタムコネクタ登録 + テスト | - | 中 | x |
| **D4** | E2E 全 AC 検証 | - | 中 | x |

---

## Phase 2.5: 統合影響分析

### 2.5.1 関連する既存機能

```
## 関連機能マップ

### この機能が依存する既存機能
- packages/db: Firestore AuditLog コレクションへの書き込み（ADR-003 準拠）
- packages/shared: DraftStatus 等の共通型（将来の連携用、今回は直接依存なし）

### この機能に依存される可能性がある機能
- apps/api: 将来的に MCP ツールの Core を直接 import して SmartHR データ取得
- apps/web: 承認ダッシュボードで SmartHR 従業員情報を表示（Core 経由）
- apps/worker: Chat/LINE からの問い合わせに対して SmartHR データを参照

### 関連する ADR/仕様書
- ADR-003: Firestore コレクション設計 → AuditLog コレクション利用
- ADR-006: Human-in-the-loop → 書き込み操作時に承認フロー連携（将来拡張）
- ADR-007: AI Role Separation → MCP ツールはデータ参照のみ、計算は行わない
- 整合性確認: ✅ 問題なし（読み取り専用のため既存フローに影響なし）
```

### 2.5.2 エンドツーエンドフロー

```
## E2E フロー

### フロー 1: Claude Code（stdio）
1. 開発者が Claude Code を起動
2. mcp-smarthr が stdio サブプロセスとして起動
3. 「従業員一覧を見せて」と質問
4. → list_employees ツール実行
5. → SmartHR API から取得 → 結果返却
6. → 監査ログ記録（stdio モードでは console 出力のみ）

### フロー 2: claude.ai / Cowork（HTTP）
1. ACG 人事担当者が claude.ai を開く
2. カスタムコネクタ「ACG SmartHR」を有効化
3. → OAuth 2.0 フローで Google ログイン
4. → MCP サーバーがトークンから email + hd を取得
5. → Layer 2: hd == "aozora-cg.com" を検証
6. → Layer 3: Firestore 許可リストに存在するか確認
7. → Layer 4: ロール（admin/readonly）を解決
8. 「田中さんの給与明細を教えて」と質問
9. → get_pay_statements ツール呼び出し
10. → admin ロール確認 → PII フィルタ適用 → 結果返却
11. → 監査ログ記録（Cloud Logging + Firestore）

### エラーフロー: ドメイン外アクセス
1. @gmail.com ユーザーが OAuth ログイン
2. → Layer 2 で hd != "aozora-cg.com" → 403 Forbidden

### エラーフロー: 許可リスト外
1. @aozora-cg.com の新入社員が OAuth ログイン
2. → Layer 3 で Firestore 許可リストに不在 → 403 Forbidden

### エラーフロー: 権限不足
1. readonly ユーザーが get_pay_statements を呼び出し
2. → Layer 4 で admin 必須 → isError: true
```

### 2.5.3 検証計画

| レベル | 対象 | 必須 |
|--------|------|------|
| 単体 | Core（レート制限、キャッシュ、PII フィルタ、認可、監査ログ） | ✅ |
| 統合 | MCP ツール → Core → SmartHR API モック | ✅ |
| 接続 | Claude Code → stdio Shell → Core | ✅ |
| 接続 | claude.ai → HTTP Shell → Core | ✅ |
| E2E | Claude → Cloud Run → SmartHR Sandbox | ✅ |

---

## Phase 2.7: Acceptance Criteria

### AC-1: 従業員情報の参照（stdio）
- **Given** Claude Code の MCP 設定に mcp-smarthr が登録されている
- **When** `list_employees` ツールを呼び出す
- **Then** 従業員リスト（最大10件）と totalCount が返る
- **検証方法**: Claude Code から実際にツール呼び出し

### AC-2: 従業員検索
- **Given** SmartHR に従業員が存在する
- **When** `search_employees` ツールを query="田中" で呼び出す
- **Then** 該当する従業員が返る
- **検証方法**: Vitest 単体テスト

### AC-3: レート制限
- **Given** SmartHR API のレート制限が 10req/sec
- **When** 20件のリクエストを連続送信する
- **Then** スロットリングにより 429 エラーが発生しない
- **検証方法**: Vitest テスト（タイミングモック）

### AC-4: PII フィルタリング
- **Given** readonly ロールのユーザー
- **When** `get_employee` で従業員詳細を取得する
- **Then** レスポンスに `birth_at`, `email`, `gender`, `bank_accounts` が含まれない
- **検証方法**: Vitest 単体テスト

### AC-5: ロールベースアクセス制御
- **Given** readonly ロールのユーザー
- **When** `get_pay_statements` ツールを呼び出す
- **Then** `isError: true` で「admin ロールが必要です」が返る
- **検証方法**: Vitest 単体テスト

### AC-6: 監査ログ
- **Given** 任意のツールが呼び出される
- **When** ツール実行が完了する
- **Then** 構造化ログ（tool, userEmail, params(PIIマスク済), result, durationMs）が出力される
- **検証方法**: Vitest テスト（console.log モック）

### AC-7: ドメイン制限（HTTP Shell）
- **Given** HTTP Shell がデプロイされている
- **When** `@aozora-cg.com` 以外の OAuth トークンでアクセスする
- **Then** HTTP 403 が返る
- **検証方法**: curl + テスト用トークン

### AC-8: 許可リスト制御
- **Given** Firestore の許可リストに登録されていない `@aozora-cg.com` ユーザー
- **When** HTTP Shell にアクセスする
- **Then** HTTP 403 が返る
- **検証方法**: Vitest テスト

### AC-9: claude.ai コネクタ接続
- **Given** claude.ai のカスタムコネクタに Cloud Run URL が登録されている
- **When** claude.ai から `list_employees` を呼び出す
- **Then** 従業員リストが返り、Claude が結果を表示する
- **検証方法**: claude.ai から手動テスト

### AC-10: エラーハンドリング
- **Given** SmartHR API が 401 を返す
- **When** 任意のツールを呼び出す
- **Then** `isError: true` で正規化されたエラーメッセージが返る（内部詳細は非露出）
- **検証方法**: Vitest テスト

---

## Phase 3: 実行戦略

### 3.1 実行順序・並列化・品質ゲート（WBS v2）

```
═══════════════════════════════════════════════════
 Phase A: Core 基盤強化
═══════════════════════════════════════════════════

 A1: Core ディレクトリ構造リファクタ（逐次・先行）
     └→ テスト 14 件が引き続き PASS することを確認

 A2: レート制限    ┐
 A3: PII フィルタ  ├ 並列実行（独立ファイル・Agent Teams 検討）
 A4: 監査ログ      │
 A5: 4 層認証      ┘

 品質ゲート: pnpm lint && pnpm typecheck && pnpm test（全 PASS）
 ★ /codex review: Core 設計レビュー
   観点:
   - SmartHR API トークンがスコープなし（フルアクセス）→ 自前権限制御の妥当性
   - PII フィルタの抜け漏れ
   - 認証 4 層構造の健全性

═══════════════════════════════════════════════════
 Phase B: Shell 実装
═══════════════════════════════════════════════════

 B1: stdio Shell ──┐
                    ├ 並列実行可能
 B2: HTTP Shell ───┘

 B3: Dockerfile（B2 完了後）

 品質ゲート: pnpm lint && pnpm typecheck && pnpm test

═══════════════════════════════════════════════════
 Phase C: GCP インフラ + デプロイ
═══════════════════════════════════════════════════

 C1: Secret Manager ─┐
                      ├ 並列実行
 C2: SA + IAM ────────┘

 C3: Cloud Run デプロイ（C1, C2, B3 完了後）

 ★ /codex review: セキュリティレビュー
   観点:
   - OAuth 2.0 + アプリ内認証の多層防御は十分か
   - Secret Manager の設定は最小権限か
   - パブリック公開 Cloud Run のリスク評価

═══════════════════════════════════════════════════
 Phase D: 接続テスト + 検証
═══════════════════════════════════════════════════

 D1: Claude Code stdio テスト ─┐
                                ├ 並列実行（D1 は Phase A 完了後に早期実行可能）
 D2: Claude Desktop stdio テスト┘

 D3: claude.ai カスタムコネクタ登録 + テスト（C3 完了後）

 D4: E2E 全 AC 検証（D1, D3 完了後）

 品質ゲート:
   /simplify（reuse/quality/efficiency 3 並列）
   /safe-refactor（3 ファイル以上のため必須）
   Evaluator 分離（5 ファイル以上 + 新機能のため必須）
 ★ /review-pr: 最終 PR レビュー（6 エージェント並列）
```

### 3.2 codex review 一覧

| # | タイミング | 観点 | 形式 |
|---|-----------|------|------|
| 1 | Phase A 完了後 | Core 設計（認証 4 層、PII フィルタ、レート制限）の妥当性 | `/codex review` |
| 2 | Phase C 完了後 | セキュリティ（OAuth + パブリック Cloud Run + Secret Manager） | `/codex security` |
| 3 | PR 作成前 | 最終レビュー | `/review-pr`（6 並列） |

### 3.3 早期フィードバックループ

**D1（Claude Code stdio テスト）を Phase A 完了直後に実行。** Cloud Run デプロイを待たずに Core の動作を実機で確認することで、手戻りリスクを最小化する。

```
Phase A → D1（早期検証） → Phase B → Phase C → D3 → D4
```

---

## Phase 4: 計画サマリー

### 変更ファイル一覧

```
packages/mcp-smarthr/
├── src/
│   ├── core/                          ← Core（トランスポート非依存）
│   │   ├── smarthr-client.ts          # 既存移動 + レート制限追加
│   │   ├── tools.ts                   # 既存移動 + 認可チェック統合
│   │   ├── types.ts                   # 既存移動 + ロール型追加
│   │   ├── server.ts                  # 新規: McpServer 定義
│   │   ├── middleware/
│   │   │   ├── auth.ts                # 新規: 4 層認証
│   │   │   ├── audit-logger.ts        # 新規: 監査ログ
│   │   │   └── pii-filter.ts          # 新規: PII フィルタ
│   │   └── lib/
│   │       └── rate-limiter.ts        # 新規: レート制限
│   │
│   ├── shells/                        ← Shell（トランスポート層）
│   │   ├── stdio.ts                   # 新規: stdio Shell
│   │   └── http.ts                    # 新規: HTTP Shell (Hono + OAuth)
│   │
│   ├── index.ts                       # 変更: shells/stdio.ts を呼び出し
│   ├── serve.ts                       # 新規: shells/http.ts を呼び出し
│   │
│   └── __tests__/
│       ├── smarthr-client.test.ts     # 変更: レート制限テスト追加
│       ├── rate-limiter.test.ts       # 新規
│       ├── pii-filter.test.ts         # 新規
│       ├── audit-logger.test.ts       # 新規
│       ├── auth.test.ts              # 新規
│       └── http-shell.test.ts         # 新規
│
├── Dockerfile                         # 新規
├── .env.example                       # 新規
└── package.json                       # 変更: hono 追加
```

**新規: 13 ファイル / 変更: 4 ファイル**
→ `/safe-refactor` + Evaluator 分離プロトコル 必須

### 認証 4 層設計

```
Layer 1: トランスポート認証
  ├ stdio: 認証スキップ（ローカル実行 = 信頼済み）
  └ HTTP:  Google OAuth 2.0 トークン検証
           → email, hd (hosted domain) を抽出

Layer 2: ドメイン検証
  └ hd == "aozora-cg.com" であること（HTTP のみ）

Layer 3: ユーザー許可リスト
  └ Firestore: mcp_allowed_users/{email}
     { email, role, enabled, createdAt, updatedAt }

Layer 4: ツール権限
  └ admin:    全ツール（get_pay_statements 含む）
     readonly: get_pay_statements 以外
```

### リスクと緩和策

| リスク | 影響 | 緩和策 |
|--------|------|--------|
| claude.ai → Cloud Run の OAuth フローが複雑 | スケジュール遅延 | stdio で Core を先に検証、HTTP は後続 |
| SmartHR Sandbox データクリーンアップ | E2E テスト失敗 | Vitest モックテストを主軸に |
| SmartHR API レート制限超過 | 429 多発 | スロットリング + Exponential Backoff |
| パブリック Cloud Run のセキュリティ | 不正アクセス | OAuth + ドメイン + 許可リスト + ツール権限の 4 層防御 |
| Google OAuth callback URL 変更 | コネクタ接続不可 | claude.ai 公式ドキュメントを監視 |

### ADR 追加の検討

本実装で以下の設計判断を記録する ADR の作成を検討:

- **ADR-008: SmartHR MCP サーバー — Core + Shell アーキテクチャ**
  - 決定: トランスポート非依存の Core と差し替え可能な Shell で構成
  - 理由: Claude Code / claude.ai / 自社アプリの全てに単一コアで対応
  - 認証: OAuth 2.0 + 4 層認証でドメイン・アカウント・ツール単位の制御
