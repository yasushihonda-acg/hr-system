# y@lend.aozora-cg.com 接続手順書（T13 実機検証用）

**対象**: `y@lend.aozora-cg.com`
**権限**: readonly（閲覧のみ、恒久許可）
**有効期限**: なし
**承認者**: yasushi.honda@aozora-cg.com
**MCP サーバー URL**: `https://mcp-smarthr-1021020088552.asia-northeast1.run.app`
**デプロイリビジョン**: `mcp-smarthr-00021-f9x`（2026-04-17 稼働）

---

## このドキュメントの目的

別テナント `lend.aozora-cg.com` のユーザー（y@lend.aozora-cg.com）が、aozora-cg.com の SmartHR データを readonly で参照できるように接続する手順。

**利用可能な接続方法**:

- **A. claude.ai Custom Connector**（Pro/Max プラン、Web・Desktop 共通）
  - claude.ai にログインして Connector を 1 回追加すれば、同じアカウントの Web ブラウザと Claude Desktop の両方で自動的に使えるようになる
- **B. Claude Code CLI**（ターミナル版、リモート MCP 接続）

---

## 事前情報

| 項目 | 値 |
|------|-----|
| MCP サーバー URL | `https://mcp-smarthr-1021020088552.asia-northeast1.run.app` |
| 認可エンドポイント | `https://mcp-smarthr-1021020088552.asia-northeast1.run.app/authorize` |
| トークンエンドポイント | `https://mcp-smarthr-1021020088552.asia-northeast1.run.app/token` |
| クライアント登録 | 自動（Dynamic Client Registration） |
| 利用可能ツール | `list_employees`, `get_employee`, `search_employees`, `list_departments`, `list_positions`（5 種、readonly） |
| 拒否されるツール | `update_employee`, `create_employee`, `get_pay_statements`（403 エラーが期待動作） |

---

## A. claude.ai Custom Connector（Web / Desktop 共通）

Claude Desktop は **リモート HTTP MCP サーバーを設定ファイル（`claude_desktop_config.json`）で直接指定できない**。claude.ai（Web）で Connector を追加すると、同一アカウントでログインしている Desktop にも自動反映される仕組みのため、Web で 1 回設定すれば OK。

### 手順

1. https://claude.ai にログイン（`y@lend.aozora-cg.com` アカウント）
2. 左下のプロフィールアイコン → **Settings** → **Connectors** → **Add custom connector**
3. 以下を入力:
   - **Name**: `aozora-hr-readonly`（任意）
   - **Remote MCP server URL**: `https://mcp-smarthr-1021020088552.asia-northeast1.run.app`
4. 「Add」をクリック
5. Connector 一覧の `aozora-hr-readonly` に「Connect」ボタンが出るのでクリック
6. Google OAuth 画面が開く → `y@lend.aozora-cg.com` を選択 → 権限同意
7. claude.ai に戻り、Connector が「Connected」状態になっていることを確認
8. チャット画面で attach（添付）アイコンからツールを選び、`list_employees` 等を呼び出して動作確認

Claude Desktop を使っている場合は同アカウントでログインすれば同じ Connector が自動で利用可能。

---

## B. Claude Code CLI

1. Claude Code CLI を最新版に更新（`claude --version` で確認）
2. ターミナルで以下を実行（URL は位置引数として最後に渡す）:

```bash
claude mcp add \
  --transport http \
  aozora-hr-readonly \
  https://mcp-smarthr-1021020088552.asia-northeast1.run.app
```

3. 初回接続時に Google OAuth URL がターミナルに表示される → ブラウザで開く
4. `y@lend.aozora-cg.com` を選択 → 認証完了
5. `claude` を起動し、`/mcp` でサーバーが Connected になっていることを確認
6. チャット画面で `list_employees` 等を呼び出して動作確認

---

## 動作確認シナリオ

接続成功後、以下を試してください。**期待する挙動どおりなら正常**:

| # | 試すこと | 期待される結果 |
|---|---------|---------------|
| 1 | 従業員一覧取得（list_employees） | 成功（200）、従業員データが返る |
| 2 | 特定従業員取得（get_employee） | 成功（200） |
| 3 | 部署一覧取得（list_departments） | 成功（200） |
| 4 | 従業員更新（update_employee） | **403 エラー**（readonly 強制、これが正しい動作） |
| 5 | 給与明細取得（get_pay_statements） | **403 エラー**（readonly 強制、これが正しい動作） |
| 6 | 従業員作成（create_employee） | **403 エラー**（readonly 強制、これが正しい動作） |

いずれの接続方法でも、認証成功後は同じ 6 項目が同じ挙動になるはず。

---

## トラブルシューティング

### 「access_denied」が OAuth 画面で表示される

- Google アカウントが `y@lend.aozora-cg.com` か確認
- 他のアカウントでログインしていないか確認（プライベートブラウジングで試す）

### 「403 Forbidden」が接続時（ツール呼出時ではなく）に出る

- 管理者（yasushi.honda@aozora-cg.com）に連絡
- Firestore `mcp-users` への登録または環境変数設定に問題がある可能性

### ツールが readonly 以外も見える / 実行できてしまう

- **セキュリティインシデント**として即座に管理者に連絡（readonly 強制が効いていない）

---

## 連絡先

- 技術的な問題: yasushi.honda@aozora-cg.com
- 権限変更依頼: 同上
- 緊急停止が必要な場合: 同上（Firestore `enabled: false` で即時停止可能）

---

## 設計背景（参考）

- ADR-008: SmartHR MCP 外部 readonly 例外メール許可（docs/adr/ADR-008-external-readonly-exception.md）
- 承認方式: 環境変数 `EXTERNAL_READONLY_EMAIL_ALLOWLIST` + Firestore `mcp-users` の二重承認
- 2 人目の外部ユーザーが発生した場合は多テナント UserStore に再設計予定（本方式の継ぎ足しは禁止）
