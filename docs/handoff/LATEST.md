# HR-AI Agent — Session Handoff

**最終更新**: 2026-04-17（PR #438 マージ + 本番デプロイ完了、T13 実機検証待ち）
**ブランチ**: `main`
**main 最新**: `2c417f3` — feat: SmartHR MCP に外部 readonly 例外メール許可機能を追加 (#438)

---

## 現在のフェーズ

**Phase 13 — SmartHR MCP 外部 readonly 例外許可（実装完了・デプロイ完了、T13 実機検証のみ残）**

`y@lend.aozora-cg.com` を readonly で恒久許可する機能が本番稼働中。外部ユーザー本人による実機検証のみが残っている状態。

---

## 今セッションの成果

### マージ済み PR

| PR | 内容 | 状態 |
|----|------|------|
| #437 | CLAUDE.md に Operational Status 追加 | ✅ マージ済み（前セッション） |
| **#438** | **SmartHR MCP に外部 readonly 例外メール許可機能を追加** | ✅ **本セッションでマージ**（`2c417f3`） |

### 作成した Issue（follow-up）

| # | 内容 | ラベル |
|----|------|--------|
| #439 | 監査ログ失敗時の silent catch 修正 | bug, P2 |
| #440 | fallback UserStore の fail-closed 化 | bug, P1 |
| #441 | 外部例外 OAuth 統合テスト追加 | enhancement, P2 |
| #442 | Mermaid 図と email 正規化の polish | enhancement, P2 |

### デプロイ状況

| 項目 | 値 |
|------|-----|
| Cloud Run リビジョン | `mcp-smarthr-00021-f9x`（100% トラフィック） |
| イメージ SHA | `2c417f3` |
| `/health` 応答 | `{"status":"ok"}` |
| 追加環境変数 | `EXTERNAL_READONLY_EMAIL_ALLOWLIST=y@lend.aozora-cg.com` |
| Firestore 登録 | 11 ユーザー（admin 4, readonly 6, external readonly 1） |

### 追加ドキュメント

| ファイル | 内容 |
|---------|------|
| `docs/adr/ADR-008-external-readonly-exception.md` | 設計判断の記録（案 A' 採用、案 B 不採用理由、増殖ガード等） |
| `docs/handoff/external-user-onboarding-y-lend.md` | y@lend.aozora-cg.com 向け接続手順書（3 クライアント対応） |

---

## WBS 進捗（T1-T14）

| ID | タスク | 状態 |
|----|-------|------|
| T1-T9 | 実装・ユニットテスト | ✅ 完了 |
| T10 | Firestore 登録 | ✅ **本セッションで完了** |
| T11 | 配信ドキュメント更新 | ✅ 完了 |
| T12 | Cloud Run デプロイ + 環境変数 | ✅ **本セッションで完了** |
| T13 | 実機検証（y@lend 本人に依頼） | ⏳ **外部依頼待ち** |
| T14 | ハンドオフ更新 | ✅ 本ドキュメントで完了 |

**進捗: 13/14（93%）** — 残作業は外部ユーザー依頼のみ

---

## T13（実機検証）の進め方

### 依頼文テンプレート

`docs/handoff/external-user-onboarding-y-lend.md` を y@lend.aozora-cg.com 本人に共有。その文書に以下が含まれている:

- 3 クライアント（claude.ai Pro / Claude Desktop / Claude Code CLI）それぞれの接続手順
- 動作確認シナリオ 6 項目（read 系成功 + write/pay_statements が 403 になること）
- トラブルシューティング
- 連絡先（yasushi.honda@aozora-cg.com）

### 検証完了後のアクション

1. 接続成功 → y@lend 本人から動作確認完了の連絡を受領
2. `docs/handoff/LATEST.md` に検証結果を追記
3. T13 を completed に更新
4. Phase 13 クローズ

### 接続に失敗した場合のデバッグポイント

- Cloud Run ログで `allowedBy` タグを確認（`external_email_exception` が出るか）
- Firestore `mcp-users` で `y@lend.aozora-cg.com` の `enabled=true` を確認
- 環境変数 `EXTERNAL_READONLY_EMAIL_ALLOWLIST` の値を確認

---

## 次セッションでの選択肢

**A. T13 結果待ちの間、Issue #439-442 から着手**（推奨）
- #440（fail-closed 化）は P1 で優先度高
- Phase 13 完了を待たず並行処理可能

**B. 長期停滞 PR の整理**
- #410（SmartHR MCP Phase 1）— 既に本番稼働しているため close 判断
- #409（ADR-008 AI エージェント拡張）— 本 ADR-008（外部例外）とは別物、重複しない名称への改名検討

**C. Issue #407 / #408（積み残し）**
- Phase 2: Anthropic HR Plugin 導入
- Phase 3: 本番 AI エージェント + /agent-lab

---

## 登録ユーザー（Firestore `mcp-users`、11 名）

| ロール | 権限 | アカウント |
|--------|------|-----------|
| admin | 閲覧 + 更新 + 登録 + 給与明細 | kosuke.omure, tomohiro.arikawa, makoto.tokunaga, yasushi.honda |
| readonly | 閲覧のみ | ryota.yagi, gen.ichihara, rika.komatsu, shoma.horinouchi, tomoko.hommura, yuka.yoshimura |
| **readonly（外部例外）** | **閲覧のみ（強制）** | **y@lend.aozora-cg.com** |

---

## Cloud Run 環境変数（全 11 項目、うち 5 つは Secret）

| 変数 | 値 | 備考 |
|------|-----|------|
| NODE_ENV | production | |
| ALLOWED_DOMAIN | aozora-cg.com | |
| AUTH_DISABLED | false | |
| IP_RESTRICTION_ENABLED | false | |
| SERVER_URL | https://mcp-smarthr-bdr4g3rk2q-an.a.run.app | |
| USE_FIRESTORE_USER_STORE | true | |
| **EXTERNAL_READONLY_EMAIL_ALLOWLIST** | **y@lend.aozora-cg.com** | **本セッションで追加** |
| SMARTHR_API_KEY | (secret) | |
| SMARTHR_TENANT_ID | (secret) | |
| GOOGLE_CLIENT_ID | (secret) | |
| GOOGLE_CLIENT_SECRET | (secret) | |
| JWT_SECRET | (secret) | |

---

## 外部 readonly 例外の運用ガイド（ADR-008 準拠）

### 狭い恒久例外

- 対象は 1 ユーザーのみ（`y@lend.aozora-cg.com`）
- 2 人目が発生した場合は多テナント UserStore に再設計（継ぎ足し禁止）

### 二重承認

- 環境変数 `EXTERNAL_READONLY_EMAIL_ALLOWLIST`（Cloud Run、SRE 管轄）
- Firestore `mcp-users`（管理者管轄）
- 両方必須で通過

### readonly 強制（Layer 3.5）

- Authorizer と OAuth `/token` の両方で `isExternalReadonlyViolation` を実施
- Firestore で write 権限が誤付与されても 403 deny

### revoke 手順

| 緊急度 | 手順 |
|--------|------|
| 即時停止 | Firestore `mcp-users` で `enabled: false` |
| 完全削除 | 上記 + 環境変数削除 + Cloud Run 再デプロイ |

---

## テスト状況

| パッケージ | テスト数 | 状態 |
|-----------|---------|------|
| packages/mcp-smarthr | 135 | 全 PASS（前セッション +37） |
| apps/api | 22+ | 全 PASS |
| apps/worker | 80 | 全 PASS |
| apps/web | 207 | 全 PASS |

---

## 既存 PR・Issue

| 番号 | 内容 | 状態 |
|------|------|------|
| #438 | 外部 readonly 例外 | ✅ マージ済 |
| #437 | CLAUDE.md Operational Status | ✅ マージ済 |
| #442 | Mermaid 図と email 正規化 polish | 🆕 作成（P2） |
| #441 | 外部例外 OAuth 統合テスト | 🆕 作成（P2） |
| #440 | fallback UserStore fail-closed 化 | 🆕 作成（P1） |
| #439 | 監査ログ silent catch 修正 | 🆕 作成（P2） |
| #410 | Phase 1 SmartHR MCP 構築（古い PR） | 積み残し、close 判断要 |
| #409 | ADR-008 AI エージェント拡張（名称重複） | 積み残し、改名検討要 |
| #408 | Phase 3: 本番 AI エージェント + /agent-lab | 積み残し |
| #407 | Phase 2: Anthropic HR Plugin 導入 | 積み残し |

---

## 再開手順

```bash
# 1. 環境確認
cd /Users/yyyhhh/Projects/ACG/hr-system
git fetch origin
git checkout main
git pull
git log --oneline -3  # 2c417f3 が HEAD であること確認

# 2. 本番稼働状況確認
curl -sS https://mcp-smarthr-1021020088552.asia-northeast1.run.app/health

# 3. Cloud Run リビジョン確認
gcloud run services describe mcp-smarthr --region=asia-northeast1 \
  --format="value(status.latestReadyRevisionName)"
# 期待値: mcp-smarthr-00021-f9x

# 4. T13 状況確認（y@lend.aozora-cg.com からの連絡）

# 5. 次セッションでの選択肢（上記「次セッションでの選択肢」参照）
```

---

## 参考資料

- PR #438: https://github.com/yasushihonda-acg/hr-system/pull/438
- ADR-008: `docs/adr/ADR-008-external-readonly-exception.md`
- 接続手順書: `docs/handoff/external-user-onboarding-y-lend.md`
- Issue #439-442: follow-up で対応予定
