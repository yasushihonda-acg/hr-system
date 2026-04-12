# SmartHR MCP サーバー内製化 — 調査結果統合レポート

> 調査日: 2026-04-12
> 目的: ACG専用SmartHR MCPサーバーの設計判断に必要な全情報を網羅的にまとめる

---

## 目次

1. [エグゼクティブサマリー](#1-エグゼクティブサマリー)
2. [SmartHR API 仕様](#2-smarthr-api-仕様)
3. [既存の SmartHR MCP サーバー調査](#3-既存の-smarthr-mcp-サーバー調査)
4. [MCP サーバー構築ベストプラクティス](#4-mcp-サーバー構築ベストプラクティス)
5. [セキュリティ・アクセス制御設計](#5-セキュリティアクセス制御設計)
6. [推奨アーキテクチャ](#6-推奨アーキテクチャ)
7. [実装方針](#7-実装方針)
8. [参考情報源](#8-参考情報源)

---

## 1. エグゼクティブサマリー

### 背景

ACG（あおぞらケアグループ）の人事業務で利用している SmartHR のデータを、Claude Desktop / claude.ai (Cowork) から安全に参照・操作するための MCP サーバーを構築する。

### 調査結果の要点

| 項目 | 結果 |
|------|------|
| SmartHR 公式 MCP サーバー（API連携用） | **存在しない** |
| OSS の SmartHR API MCP サーバー | TomoyaGoto 氏の個人 PoC が唯一（セキュリティ問題多数） |
| SmartHR 公式の MCP サーバー | Design System 用のみ（`@smarthr/design-system-mcp-server`） |
| 推奨アプローチ | **ACG 専用で TypeScript により自作**（既存モノレポに統合） |

### なぜ自作が最善か

1. 公式・OSS ともに API データアクセス用の MCP サーバーが存在しない
2. 給与情報（PII 最高機密）を扱うため、第三者コードのリスクを排除
3. ACG が必要な操作のみに絞った最小権限設計が可能
4. 既存モノレポ（TypeScript / Hono / Firestore）との技術スタック統一

---

## 2. SmartHR API 仕様

### 2.1 基本情報

| 項目 | 値 |
|------|-----|
| ベース URL（本番） | `https://{tenant_id}.smarthr.jp/api/v1/` |
| ベース URL（Sandbox） | `https://{tenant_id}.daruma.space/api/v1/` |
| プロトコル | HTTPS (REST API) |
| データ形式 | JSON |
| API バージョン | v1 |
| OpenAPI 仕様書 | 公開ダウンロードなし（SPA 内部で利用の可能性） |

### 2.2 認証方式

| 方式 | 使い方 |
|------|--------|
| BASIC 認証 | `curl -u ACCESS_TOKEN:` |
| Bearer トークン | `Authorization: Bearer ACCESS_TOKEN` |

- 管理者のみがトークンを発行可能
- 発行時に1度だけ表示（再表示不可）
- 明示的な有効期限・リフレッシュメカニズムの記載なし
- OAuth 2.0 フローは提供されていない（静的アクセストークン方式）
- スコープの概念なし（トークン単位でフルアクセス）

### 2.3 レート制限

| レベル | 制限 | レスポンスヘッダー |
|--------|------|-------------------|
| トークン / 秒 | **10 リクエスト** | `x-rate-limit-*-second` |
| トークン / 時間 | **5,000 リクエスト** | `x-rate-limit-*` |
| サブドメイン / 分 | **50,000 リクエスト** | `x-intensive-rate-limit-*` |

- 制限超過時: HTTP 429 返却
- `x-rate-limit-remaining` / `x-rate-limit-reset` でリアルタイム監視可能

### 2.4 ページネーション

| 項目 | 値 |
|------|-----|
| 方式 | オフセットベース |
| パラメータ | `page`（初期値: 1）, `per_page`（初期値: 10, **最大: 100**） |
| 総件数 | `x-total-count` ヘッダー |
| ナビゲーション | `Link` ヘッダー（first, last, next, prev） |
| ソート | `sort` パラメータ（複数キー対応、`-` で降順） |

### 2.5 エラーコード体系

| code | type | HTTP | リトライ |
|------|------|------|---------|
| 1 | `bad_request` | 400 | 不可 |
| 2 | `unauthorized_token` | 401 | 不可（トークン再発行） |
| 3 | `forbidden` | 403 | 不可 |
| 4 | `not_found` | 404 | 不可 |
| 5 | `internal_server_error` | 500 | **可**（Exponential Backoff） |
| 6 | `too_many_requests` | 429 | **可**（reset 値に基づく待機） |
| 7 | `plan_limit_exceeded` | 403 | 不可 |
| 8 | `non_deletable_resource` | 400 | 不可 |
| 9 | `service_maintenance` | 503 | **可**（時間をおいてリトライ） |
| 15 | `ip_not_permitted` | 403 | 不可 |

### 2.6 主要 API エンドポイント

#### 従業員 (Crews)

| メソッド | パス | 概要 |
|---------|------|------|
| GET | `/v1/crews` | 従業員リスト取得 |
| POST | `/v1/crews` | 従業員登録 |
| GET | `/v1/crews/{id}` | 従業員取得 |
| PUT | `/v1/crews/{id}` | 従業員全体更新 |
| PATCH | `/v1/crews/{id}` | 従業員部分更新 |
| DELETE | `/v1/crews/{id}` | 従業員削除 |
| PUT | `/v1/crews/{id}/invite` | 従業員招待 |

#### 家族情報 (Dependents)

| メソッド | パス | 概要 |
|---------|------|------|
| GET/POST | `/v1/crews/{crew_id}/dependents` | リスト / 登録 |
| GET/PUT/DELETE | `/v1/crews/{crew_id}/dependents/{id}` | 取得 / 更新 / 削除 |

#### 組織マスタ

| リソース | パス | 操作 |
|---------|------|------|
| 部署 | `/v1/departments` | CRUD |
| 雇用形態 | `/v1/employment_types` | 読み取り |
| 役職 | `/v1/job_titles` | 読み取り |
| 事業所 | `/v1/biz_establishments` | 読み取り |
| 続柄 | `/v1/dependent_relations` | 読み取り |

#### 給与関連

| メソッド | パス | 概要 |
|---------|------|------|
| GET | `/v1/payrolls` | 給与明細グループ取得 |
| POST | `/v1/payrolls/{payroll_id}/payslips` | 給与明細登録 |
| GET | `/v1/payment_periods` | 給与支給期間取得 |
| GET | `/v1/crews/{crew_id}/bank_accounts` | 口座情報取得 |

#### その他

| リソース | パス | 操作 |
|---------|------|------|
| カスタム項目テンプレート | `/v1/crew_custom_field_templates` | 読み取り |
| ユーザー | `/v1/users` | 読み取り |
| Webhook | `/v1/webhooks` | CRUD |

### 2.7 Webhook

| イベント | トリガー |
|---------|---------|
| `crew_created` / `crew_updated` / `crew_deleted` | 従業員 CRUD |
| `crew_imported` | 従業員一括インポート |
| `dependent_created` / `dependent_updated` / `dependent_deleted` | 家族 CRUD |
| `dependent_imported` | 家族一括インポート |
| `workflow_approved` | 最終承認完了 |

- リトライ: 本番17回（約3日）、Sandbox 5回（約8分）
- `X-SmartHR-Token` ヘッダーで署名検証可能
- 60秒以内に 200 番台レスポンスが必要
- `skip_sending_webhook=true` で送信抑止可能

### 2.8 既知の注意事項

| 項目 | 内容 |
|------|------|
| 画像 URL | **180秒で無効化**。取得後即ダウンロードが必要 |
| ID の使い分け | `id`=従業員UUID、`user_id`=アカウントUUID（招待後のみ）、`emp_code`=社員番号 |
| カスタム項目 | ドロップダウン型は要素 ID または物理名で指定（表示名は不可） |
| 部署名 | `/` 文字の使用不可 |
| Sandbox | 予告なくデータクリーンアップされる場合あり |

---

## 3. 既存の SmartHR MCP サーバー調査

### 3.1 一覧

| # | 名前 | 作者 | 用途 | 評価 |
|---|------|------|------|------|
| 1 | `@smarthr/design-system-mcp-server` | SmartHR 公式 | UI コンポーネント情報 | API 連携には使えない |
| 2 | `smarthr_mcp_server` | TomoyaGoto（個人） | API v1 CRUD | PoC、セキュリティ問題多数 |
| 3 | SmartHR 社内 MCP | SmartHR 社内 | ヘルプページ自動生成 | 非公開 |

### 3.2 TomoyaGoto/smarthr_mcp_server の詳細評価

**基本情報**: Python / FastMCP / MIT / Stars 0 / 最終更新 2025年2月

**セキュリティ問題（12件）**:

| # | 深刻度 | 問題 | ACG版での対策 |
|---|--------|------|--------------|
| 1 | Critical | URL インジェクション（f-string 直結合） | `encodeURIComponent()` 使用 |
| 2 | Critical | 入力サニタイズなし | Zod スキーマで厳格検証 |
| 3 | High | HTTPS 強制なし | Cloud Run で TLS 必須 |
| 4 | High | 添付ファイル制限なし（DoS） | サイズ / MIME 検証 |
| 5 | High | DELETE にガードなし | MCP ツールとして非公開 or Human-in-the-loop |
| 6 | High | PUT 全体更新で null 上書きリスク | PATCH のみ提供 |
| 7 | Medium | レート制限なし | スロットリング + `x-rate-limit` 監視 |
| 8 | Medium | メソッド重複定義 | TypeScript 型システムで防止 |
| 9 | Medium | `raise_for_status()` 欠落 | 統一エラーハンドリング |
| 10 | Medium | 認可制御なし | ロールベースアクセス制御 |
| 11 | Low | 監査ログなし | AuditLog 記録（7年保持） |
| 12 | Low | PII ログ出力リスク | PII マスキング |

**有用な設計知見**:
- API エンドポイントマッピング（44ツール / 8カテゴリ）
- CRUD パターン: create / get / list / update / partial_update / delete
- 命名規則: `smarthr_{操作}_{リソース}`
- バリデーション: 日付 YYYY-MM-DD、rank 1-99999、部署名 `/` 禁止

### 3.3 SmartHR 社の MCP 活用事例

- **ヘルプページ自動生成**: 1ページ 1-2時間 → 30分に短縮（75%削減）
- **Design System MCP**: `getScreenImplementationInstruction` で実装ガイダンスを構造化して返すユニークなパターン
- **AI 戦略**: 2030年売上 1,000億円目標、AI は自然にサービスに埋め込む方針
- **内部ツール**: Cursor + MCP + Cursor Rules で組織的に開発効率化

---

## 4. MCP サーバー構築ベストプラクティス

### 4.1 MCP 仕様（2026年時点）

| 項目 | 推奨 |
|------|------|
| トランスポート | **Streamable HTTP**（SSE は非推奨） |
| 認証 | **OAuth 2.1 + PKCE (S256)** |
| メタデータ | Protected Resource Metadata (RFC 9728) |
| クライアント登録 | Client ID Metadata Documents (CIMD) |

### 4.2 ツール設計のベストプラクティス

- **単一目的サーバー**: 機能を絞る（kitchen-sink サーバーは避ける）
- **入力バリデーション**: Zod スキーマで厳密に定義
- **説明文**: `title` + `description` を明確に記載
- **アノテーション**: `destructiveHint`, `idempotentHint` で挙動をヒント
- **エラーハンドリング**: `isError: true` でツールレベルのエラーを LLM に伝達
- **outputSchema**: 構造化レスポンスで型安全性を確保

### 4.3 TypeScript 実装

```typescript
// 基本構成
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'acg-smarthr-mcp',
  version: '1.0.0',
}, {
  instructions: 'ACGの人事データ（SmartHR）を参照するためのMCPサーバーです。',
});
```

### 4.4 Hono との統合

既存モノレポ（apps/api が Hono）と一貫性を保つため、Hono をベースに構築。

```typescript
import { Hono } from 'hono';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = new Hono();

app.post('/mcp', async (c) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // ステートレス
  });
  const server = createMcpServer();
  await server.connect(transport);
  // ...
});
```

### 4.5 OWASP MCP Top 10

| # | カテゴリ | 本プロジェクトへの影響 |
|---|---------|---------------------|
| MCP01 | トークン管理不備 | 給与情報 PII に直結 |
| MCP02 | スコープクリープ | 最小権限設計が必須 |
| MCP03 | ツールポイズニング | ツール整合性検証 |
| MCP04 | サプライチェーン攻撃 | 依存パッケージの監視 |
| MCP05 | コマンドインジェクション | Zod 入力バリデーション |
| MCP06 | インテントフロー転覆 | コンテキストフィルタリング |
| MCP07 | 認証・認可不足 | OAuth 2.1 + IAM |
| MCP08 | 監査・テレメトリ不足 | 全ツール呼び出しログ |
| MCP09 | Shadow MCP サーバー | managed-mcp.json 制御 |
| MCP10 | コンテキストインジェクション | セッション分離 |

---

## 5. セキュリティ・アクセス制御設計

### 5.1 Cloud Run IAM によるドメイン制限

```bash
# サービスデプロイ（認証必須）
gcloud run deploy mcp-smarthr \
  --project=hr-system-487809 \
  --region=asia-northeast1 \
  --no-allow-unauthenticated

# @aozora-cg.com ドメイン全体に invoker 権限を付与
gcloud run services add-iam-policy-binding mcp-smarthr \
  --project=hr-system-487809 \
  --region=asia-northeast1 \
  --member="domain:aozora-cg.com" \
  --role="roles/run.invoker"
```

**補強策**: Domain Restricted Sharing (DRS) で `aozora-cg.com` 以外への IAM 付与をブロック。

### 5.2 Identity-Aware Proxy (IAP)

Cloud Run に直接 IAP を有効化可能（ロードバランサ不要、追加コスト無し）。

```bash
gcloud run services update mcp-smarthr \
  --project=hr-system-487809 \
  --region=asia-northeast1 \
  --iap
```

- ブラウザベースの Google ログイン画面が自動提供
- `X-Goog-Authenticated-User-Email` ヘッダーでユーザー特定
- BeyondCorp アクセスレベルとの組み合わせで端末制限も可能

### 5.3 Secret Manager でのトークン管理

```bash
# シークレット作成
echo -n "YOUR_SMARTHR_API_KEY" | gcloud secrets create smarthr-api-key \
  --project=hr-system-487809 \
  --replication-policy="user-managed" \
  --locations="asia-northeast1" \
  --data-file=-

# Cloud Run デプロイ時にマウント（ボリュームマウント推奨）
gcloud run deploy mcp-smarthr \
  --service-account=mcp-smarthr-sa@hr-system-487809.iam.gserviceaccount.com \
  --update-secrets="/secrets/smarthr-api-key=smarthr-api-key:latest"
```

**ボリュームマウント vs 環境変数**: ボリュームマウントはアクセス時に最新値を取得するため、トークンローテーションとの相性が良い。

### 5.4 ツール単位の権限制御

| ツール | read-only | admin | 機密度 |
|--------|-----------|-------|--------|
| `crew_list` | o | o | 中 |
| `crew_get` | o | o | 中 |
| `crew_search` | o | o | 中 |
| `department_list` | o | o | 低 |
| `payslip_get` | x | o | **高（PII）** |
| `crew_update` | x | o | 高 |

### 5.5 監査ログ

- 全ツール呼び出しを Cloud Logging（構造化ログ）+ Firestore AuditLog に記録
- PII フィールド（氏名、住所、銀行口座、給与額）はログマスキング
- 7年保持（ADR-003 準拠）
- BigQuery へのログシンクで長期分析

### 5.6 PII 保護

| 分類 | フィールド例 | 保護レベル |
|------|-------------|-----------|
| 最高機密 | 給与額, マイナンバー | 暗号化 + アクセス制限 + ログ除外 |
| 高機密 | 生年月日, メール, 性別 | アクセス制限 + ログマスキング |
| 通常 | 氏名, 部署, 役職 | アクセスログ記録 |

---

## 6. 推奨アーキテクチャ

### 6.1 全体構成

```
Claude Desktop / claude.ai (Cowork)
    │
    │  Streamable HTTP (HTTPS)
    │  Authorization: Bearer <OAuth token>
    │
    ▼
Cloud Run: mcp-smarthr (asia-northeast1)
├── IAP: @aozora-cg.com ドメイン認証
├── /mcp (Streamable HTTP エンドポイント)
├── /.well-known/oauth-protected-resource (RFC 9728)
│
├── Service Layer
│   ├── 権限チェック (read-only / admin)
│   ├── 監査ログ記録
│   └── PII フィルタリング
│
├── SmartHR Client
│   ├── Bearer Token (Secret Manager)
│   ├── レート制限 (100ms 間隔 + x-rate-limit 監視)
│   └── エラーハンドリング (429/5xx リトライ)
│
└── ツール
    ├── crew_list / crew_get / crew_search  (read-only)
    ├── department_list                      (read-only)
    ├── payslip_get                          (admin)
    └── crew_update                          (admin, Human-in-the-loop)
```

### 6.2 接続パターン

| クライアント | 接続方法 |
|-------------|---------|
| Claude Desktop（ローカル開発） | `gcloud run services proxy` で IAM 認証経由 |
| claude.ai (Cowork) | カスタムコネクタとして登録（OAuth 2.1） |
| Claude Code | `claude_desktop_config.json` にリモート MCP URL 設定 |

### 6.3 既存システムとの統合

```
packages/
  mcp-smarthr/          ← 新規作成
    src/
      index.ts          MCP サーバーエントリポイント (Hono)
      server.ts         McpServer 定義 + ツール登録
      tools/            ツール定義（Zod スキーマ + ハンドラ）
        crew.ts
        department.ts
        payslip.ts
      client/           SmartHR API クライアント
        smarthr-client.ts
        rate-limiter.ts
      middleware/        認証・認可・監査
        auth.ts
        audit-logger.ts
        pii-filter.ts
      types/            型定義
    Dockerfile
    package.json
```

---

## 7. 実装方針

### 7.1 Phase 分割

| Phase | 内容 | ツール数 |
|-------|------|---------|
| **Phase 1** | 読み取り専用ツール + Secret Manager + 監査ログ | 4 |
| **Phase 2** | 権限制御 (read-only / admin) + PII フィルタリング | +2 |
| **Phase 3** | リモート MCP 化 (Streamable HTTP + OAuth 2.1) + Cloud Run デプロイ | - |
| **Phase 4** | claude.ai カスタムコネクタ登録 + managed-mcp.json | - |

### 7.2 Phase 1 ツール一覧

| ツール名 | 説明 | SmartHR API |
|---------|------|-------------|
| `crew_list` | 従業員一覧取得 | `GET /v1/crews` |
| `crew_get` | 従業員詳細取得 | `GET /v1/crews/{id}` |
| `crew_search` | 従業員検索 | `GET /v1/crews?q=...` |
| `department_list` | 部署一覧取得 | `GET /v1/departments` |

### 7.3 技術スタック

| レイヤー | 技術 |
|---------|------|
| MCP SDK | `@modelcontextprotocol/sdk` |
| HTTP フレームワーク | Hono |
| バリデーション | Zod |
| HTTP クライアント | Node.js `fetch` |
| 認証 | Google OAuth 2.0 + IAP |
| シークレット管理 | GCP Secret Manager |
| 監査ログ | Cloud Logging + Firestore |
| テスト | Vitest |
| Lint / Format | Biome |

### 7.4 OSS からの設計流用と改善

| 観点 | OSS (TomoyaGoto) | ACG版 |
|------|-------------------|-------|
| 言語 | Python (FastMCP) | **TypeScript** (MCP SDK + Hono) |
| ツール数 | 44（全 API） | **4-6**（最小権限） |
| 認証 | 環境変数 | **Secret Manager** + IAP |
| アクセス制御 | なし | **ロールベース** (read-only / admin) |
| 入力検証 | Pydantic（最低限） | **Zod**（厳格） |
| エラー処理 | 不統一 | **統一ハンドラ** + リトライ |
| 監査 | なし | **全操作 AuditLog** (7年保持) |
| PII 保護 | なし | **フィルタリング + マスキング** |
| DELETE 操作 | ガードなし | **非公開 or Human-in-the-loop** |
| 更新操作 | PUT（全体置換） | **PATCH のみ**（部分更新） |

---

## 8. 参考情報源

### SmartHR 公式

- [SmartHR API 概要](https://developer.smarthr.jp/api/about_api)
- [SmartHR API リファレンス](https://developer.smarthr.jp/api)
- [SmartHR Webhook 概要](https://developer.smarthr.jp/api/about_webhook)
- [SmartHR Sandbox 概要](https://developer.smarthr.jp/api/about_sandbox)
- [SmartHR API リリースノート](https://support.smarthr.jp/ja/release-notes/api/page/1/)
- [SmartHR API レート制限](https://support.smarthr.jp/ja/info/update/3dv2yl11xb9/)
- [SmartHR API アクセストークン発行](https://support.smarthr.jp/ja/help/articles/360026266033/)
- [SmartHR for Developers](https://developer.smarthr.jp/)
- [SmartHR Plus パートナープログラム](https://www.smarthr.plus/partner)

### SmartHR Tech Blog

- [MCP Server で大量のヘルプページを爆速で作る](https://tech.smarthr.jp/entry/2025/12/04/081310)
- [AI コードエディタ Cursor 大活用](https://tech.smarthr.jp/entry/2025/04/09/193526)
- [AI 活用 LT 大会](https://tech.smarthr.jp/entry/2025/06/06/173416)
- [SmartHR Plus アプリストアを支える技術](https://tech.smarthr.jp/entry/platform-app-store)

### SmartHR npm / GitHub

- [@smarthr/design-system-mcp-server (npm)](https://www.npmjs.com/package/@smarthr/design-system-mcp-server)
- [kufu/smarthr-design-system (GitHub)](https://github.com/kufu/smarthr-design-system)
- [kufu/smarthr-ui (GitHub)](https://github.com/kufu/smarthr-ui)

### MCP 仕様

- [MCP Transports 仕様](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [2026 MCP Roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)

### セキュリティ

- [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/)
- [OWASP MCP Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html)
- [Claude カスタムコネクタ（リモート MCP）](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [カスタムコネクタの構築方法](https://support.claude.com/en/articles/11503834-build-custom-connectors-via-remote-mcp-servers)

### GCP

- [Cloud Run で リモート MCP サーバーをデプロイ](https://docs.google.com/run/docs/tutorials/deploy-remote-mcp-server)
- [Cloud Run で MCP サーバーをホスト](https://docs.google.com/run/docs/host-mcp-servers)
- [Cloud Run IAM アクセス管理](https://docs.google.com/run/docs/securing/managing-access)
- [Cloud Run IAP 有効化](https://docs.google.com/iap/docs/enabling-cloud-run)
- [Cloud Run シークレット設定](https://cloud.google.com/run/docs/configuring/services/secrets)
- [Secret Manager ベストプラクティス](https://cloud.google.com/secret-manager/docs/best-practices)

### OSS 参考

- [TomoyaGoto/smarthr_mcp_server (GitHub)](https://github.com/TomoyaGoto/smarthr_mcp_server)
- [mcp.so SmartHR MCP Server](https://beta.mcp.so/zh/server/smarthr_mcp_server/TomoyaGoto)
