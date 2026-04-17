# ADR-008: SmartHR MCP 外部 readonly 例外メール許可

| 項目 | 内容 |
|------|------|
| 日付 | 2026-04-17 |
| ステータス | 承認済み |
| 決定者 | アーキテクチャチーム |
| 関連 PR | #438 |

---

## コンテキスト (Context)

SmartHR MCP サーバーは `aozora-cg.com` ドメインに閉じた 4 レイヤー認証（Transport / Domain / UserStore / Tool Permission）で本番運用中である。claude.ai Team プランのカスタムコネクタ経由で社内ユーザーが利用している。

今回、別テナント `y@lend.aozora-cg.com`（関連会社アカウント）に対して、**恒久的かつ狭い範囲で readonly 権限** を付与したい要件が発生した。

### 制約

- 対象は 1 ユーザーのみ（ドメイン全体の許可ではない）
- 期限未定（恒久許可の可能性あり）
- 利用クライアント: claude.ai Pro カスタムコネクタ、Claude Desktop、Claude Code CLI（Team プラン以外）
- 信頼レベルはドメインユーザーと同等
- 初期は readonly のみ（将来変更の可能性あり）
- 2 人目以降が発生した場合は多テナント UserStore に再設計（本方式の継ぎ足しは禁止）

### 既存 4 レイヤー認証との整合性

現行の Layer 2（Domain 検証）は `hd` パラメータと OAuth callback の `email.endsWith("@aozora-cg.com")` で単一ドメインを強制している。外部ユーザーを通すには Layer 2 に例外経路が必要。ただし Layer 3（UserStore）・Layer 4（Tool Permission）の独立性は保持する必要がある。

---

## 決定 (Decision)

**案 A'（環境変数 `EXTERNAL_READONLY_EMAIL_ALLOWLIST` + Firestore `mcp-users` の二重承認方式）** を採用する。

### 設計の核

1. **二重承認ガード**: 外部ユーザーは **環境変数許可リストに存在し、かつ Firestore `mcp-users` に登録されている** 場合のみ通過する
2. **readonly 強制ガード（Layer 3.5）**: 外部例外ユーザーに admin/write/pay_statements 権限が Firestore に誤設定されても、Authorizer と OAuth `/token` で deny する
3. **hd パラメータ条件付き送信**: 外部例外ありの場合のみ `/authorize` の `hd` を省略し、外部テナントユーザーが認可画面に到達できるようにする。セキュリティは callback 側の `isAllowedIdentity` で担保
4. **監査ログ `allowedBy` タグ**: `domain` / `external_email_exception` / `denied` で通過経路を識別

### 実装

| コンポーネント | 変更点 |
|---------------|--------|
| `isAllowedIdentity` 共通関数 | Layer 2 判定をドメイン優先 → 外部許可リスト照合の順で実施 |
| Authorizer | `externalAllowlist` を受け取り、`isExternalReadonlyViolation` で readonly 強制 |
| OAuth `/authorize` | `externalAllowlist` 非空時のみ `hd` パラメータ省略 |
| OAuth `/token` | JWT 発行前に `entry.allowedBy === "external_email_exception"` の場合 readonly 不変条件を再検証 |
| 環境変数パース | ワイルドカード拒否、email 形式検証、重複排除、起動時 fail-fast |
| Firestore `UserDocument` | `external`, `approvedBy`, `approvedAt`, `reason` 運用メタデータを追加 |

### revoke 手順

| 緊急度 | 手順 |
|--------|------|
| 即時停止 | Firestore `mcp-users` の `enabled: false` 更新 |
| 完全削除 | 上記 + Cloud Run 環境変数 `EXTERNAL_READONLY_EMAIL_ALLOWLIST` から該当メール削除 + 再デプロイ |

---

## 理由 (Rationale)

### 案 A'（二重承認方式）を採用した理由

- **Layer 独立性の保持**: 環境変数は Layer 2、Firestore は Layer 3 の責務を保ったまま、どちらか 1 つのミスでは通過しない
- **運用透明性**: 環境変数は SRE が管理、Firestore は人事・管理者が管理。二系統で相互チェックが効く
- **readonly 強制の最終防衛線**: Firestore 誤設定で write 権限が付与されても Layer 3.5 で deny されるため、実害を防げる
- **hd 条件付き送信のセキュリティ担保**: `hd` を省略しても callback の `isAllowedIdentity` で弾かれるため、セキュリティは低下しない

### Codex レビューで指摘された追加安全策（採用済）

- **OAuth `/token` 再検証**: JWT 発行直前に readonly 不変条件を再検証（race condition 対策）
- **stdio shell への配線**: HTTP だけでなく stdio エントリポイントでも externalAllowlist を有効化

---

## 代替案 (Alternatives Considered)

### 案 B: Authorizer に `bypassDomainCheck` フラグを追加

- Firestore `UserDocument` に `bypassDomainCheck: true` フラグを持たせ、該当時のみ Layer 2 をスキップ
- **不採用理由**: Layer 2（ドメイン）と Layer 3（UserStore）の独立性が崩れ、Firestore 単独で Layer 2 を無効化できてしまう。Codex レビューでも同様の指摘

### 案 C: 多テナント UserStore に先行リファクタ

- 複数ドメインを扱う汎用設計に今すぐリファクタ
- **不採用理由**: 現時点で 1 ユーザーのみの要件。YAGNI。2 人目発生時に再設計する方針を明記することで、継ぎ足し禁止の規律を保つ

### 案 D: SmartHR API キーの分離

- 外部ユーザー用に別の SmartHR API キーを発行し、Layer 4 で使い分け
- **不採用理由**: 信頼レベルがドメインユーザーと同等という前提。Layer 4 の Tool Permission で十分にカバーされるため、キー分離の複雑性を追加する価値がない

### 案 E: JWT 寿命の短縮

- 外部ユーザーの JWT を通常より短い寿命にする
- **不採用理由**: 信頼レベル同等の前提。差別化する意味がない

---

## 影響 (Consequences)

### ポジティブ

- 別テナントユーザーに対する狭い恒久例外を、4 レイヤー認証の独立性を保ったまま実現
- 二重承認により運用ミスによる意図しない通過を構造的に防止
- 監査ログの `allowedBy` タグで通過経路が後から追跡可能
- readonly 強制ガードにより Firestore 誤設定の実害を最小化

### ネガティブ / リスク

- **運用知識の分散**: 外部ユーザーの管理に環境変数（SRE）と Firestore（管理者）の両方が必要になる
  - 対策: `/docs` `/guide` に運用手順を明記。revoke 手順を ADR 内に記載
- **増殖リスク**: 2 人目、3 人目と継ぎ足されると Layer 2 が複雑化する
  - 対策: 本 ADR に「2 人目が出た場合は多テナント UserStore に再設計」を明記。環境変数ベースの継ぎ足しは禁止
- **hd 省略時の認可画面**: 外部テナントユーザーが Google 認可画面で他のテナントアカウントを誤選択する可能性
  - 対策: callback 側の `isAllowedIdentity` で許可リスト外は弾く。認可画面誤操作は deny ログで検出可能

---

## 運用ガイドライン

### 追加手順（新規外部ユーザー登録、**ただし 2 人目は再設計フェーズに移行**）

1. Cloud Run 環境変数 `EXTERNAL_READONLY_EMAIL_ALLOWLIST` に追加
2. Firestore `mcp-users` に `external: true`, `role: "readonly"`, `approvedBy`, `approvedAt`, `reason` と共に登録
3. Cloud Run 再デプロイ
4. 監査ログで `allowedBy: external_email_exception` を確認

### 増殖ガード

- 2 人目の外部ユーザー要件が発生した時点で、本 ADR の方式は **拡張禁止**
- 多テナント UserStore（ドメインごとの許可設定、テナント別 Tool Permission 等）にリファクタしてから対応する

---

## 関連 ADR / PR

- [ADR-001: 全体アーキテクチャ — GCPベース構成](./ADR-001-gcp-architecture.md)
- [ADR-003: データベース選定 — Firestore + BigQuery ハイブリッド](./ADR-003-database-selection.md)
- PR #438: feat: SmartHR MCP に外部 readonly 例外メール許可機能を追加
