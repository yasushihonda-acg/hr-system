# y@lend.aozora-cg.com 宛 依頼文（メール / チャット 転送用）

以下をそのまま y@lend.aozora-cg.com 本人に送ってください。件名・本文に分けているので用途に応じて調整可能です。

---

## 件名

【依頼】SmartHR MCP サーバーへの接続確認（readonly アクセス）

---

## 本文

`y@lend.aozora-cg.com` さま

aozora-cg.com の SmartHR データを Claude から参照できるよう、別テナントユーザーとしての例外許可設定が完了しました。接続確認をお願いします。

### 付与した権限

- **ロール**: readonly（閲覧のみ、恒久許可）
- **利用可能ツール**: 従業員・部署・役職の一覧／検索／詳細取得（5 種）
- **拒否されるツール**: 従業員更新・作成・給与明細参照（403 が返る仕様）

### 接続情報

- **MCP サーバー URL**: `https://mcp-smarthr-1021020088552.asia-northeast1.run.app`
- **認証**: Google OAuth（`y@lend.aozora-cg.com` で認証してください）
- **権限同意は初回のみ必要**

### 接続方法（どちらか 1 つで OK）

#### A. claude.ai Custom Connector（Web / Desktop 共通、推奨）

1. https://claude.ai に `y@lend.aozora-cg.com` でログイン
2. 左下プロフィールアイコン → **Settings** → **Connectors** → **Add custom connector**
3. 以下を入力して「Add」
   - Name: `aozora-hr-readonly`（任意）
   - Remote MCP server URL: `https://mcp-smarthr-1021020088552.asia-northeast1.run.app`
4. 一覧から「Connect」→ Google OAuth 画面で `y@lend.aozora-cg.com` を選択 → 権限同意
5. 「Connected」になれば成功。Claude Desktop アプリを同じアカウントで使っている場合は自動で同期

#### B. Claude Code CLI（ターミナル利用の方）

```bash
claude mcp add \
  --transport http \
  aozora-hr-readonly \
  https://mcp-smarthr-1021020088552.asia-northeast1.run.app
```

初回実行時に表示される OAuth URL をブラウザで開いて認証。`claude` 起動後 `/mcp` で Connected になっていれば成功。

### 動作確認のお願い

接続後、以下を試していただき、結果を教えてください。

| # | 試すこと | 期待される結果 |
|---|---------|---------------|
| 1 | `list_employees`（従業員一覧） | 成功、データが返る |
| 2 | `get_employee`（特定の従業員） | 成功 |
| 3 | `update_employee`（更新） | **403 エラー** ←これが正しい動作 |
| 4 | `get_pay_statements`（給与明細） | **403 エラー** ←これが正しい動作 |

**ポイント**:
- 3, 4 は 403 が返ることが「正しい動作」です。readonly 強制が効いている証拠になるので、必ず試してください
- 3 を試す際は、1 で取得した従業員一覧から存在する `employee_id` を指定してください（存在しない ID だと 400 が先に返り、認可チェックまで到達しません）

### うまくいかない場合

- OAuth 画面で `access_denied` が出る → 以下を順に確認
  - 別の Google アカウントでログイン中 → プライベートブラウジングで再試行
  - claude.ai アカウントが `y@lend.aozora-cg.com` で未登録 → claude.ai でアカウント新規登録後に再試行
- 接続直後に 403 が返る → yasushi.honda@aozora-cg.com に連絡（Firestore 登録や環境変数の問題の可能性）
- 3, 4 が成功してしまう → **即連絡**（readonly 強制が効いていない異常、セキュリティインシデント）

### 連絡先

yasushi.honda@aozora-cg.com

緊急停止が必要な場合は即時対応可能です（Firestore 設定で即 disable）。

お手数ですがよろしくお願いいたします。

---

## 補足（送信者向けメモ）

- この依頼文は `docs/handoff/y-lend-request-message.md` に保管済み
- 詳細な技術情報は `docs/handoff/external-user-onboarding-y-lend.md`
- 設計判断は `docs/adr/ADR-008-external-readonly-exception.md`
- 接続後、本人からの連絡が来たら `docs/handoff/LATEST.md` の T13 を `completed` に更新し、Phase 13 を正式クローズ
