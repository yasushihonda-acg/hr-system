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

- **A. claude.ai カスタムコネクタ**（Pro / Max プラン、Web・デスクトップアプリ共通）
  - claude.ai にログインしてカスタムコネクタを 1 回追加すれば、同じアカウントの Web ブラウザと Claude デスクトップアプリの両方で自動的に使えるようになる
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
| 拒否されるツール | `update_employee`, `create_employee`（403 エラーが期待動作） |

---

## A. claude.ai カスタムコネクタ（Web / デスクトップアプリ共通）

Claude デスクトップアプリは **リモート HTTP MCP サーバーを設定ファイル（`claude_desktop_config.json`）で直接指定できない**。claude.ai（Web）でカスタムコネクタを追加すると、同一アカウントでログインしているデスクトップアプリにも自動反映される仕組みのため、Web で 1 回設定すれば OK。

### 手順（claude.ai の日本語 UI 表記に準拠）

1. https://claude.ai にログイン（`y@lend.aozora-cg.com` アカウント）
2. 左下のプロフィールアイコン → **設定** → **コネクタ** → **カスタムコネクタを追加**
3. 以下を入力:
   - **名前**: `SmartHR`（任意）
   - **リモート MCP サーバー URL**: `https://mcp-smarthr-1021020088552.asia-northeast1.run.app`
4. 「**追加**」をクリック
5. コネクタ一覧の `SmartHR` に「**連携させる**」ボタンが出るのでクリック
6. Google 認証画面が開く → `y@lend.aozora-cg.com` を選択 → 権限に同意
7. claude.ai に戻り、コネクタが「**連携済み**」状態になっていることを確認（右上に「**切断する**」ボタンが表示されていれば OK）
8. 会話画面の **+** ボタン → **コネクタ** で SmartHR を ON にしてからツール（従業員一覧 / 従業員詳細 等）を呼び出して動作確認

Claude デスクトップアプリを使っている場合は同じアカウントでログインすれば同じコネクタが自動で利用可能。

---

## B. Claude Code CLI

1. Claude Code CLI を最新版に更新（`claude --version` で確認）
2. ターミナルで以下を実行（URL は位置引数として最後に渡す）:

```bash
claude mcp add \
  --transport http \
  smarthr \
  https://mcp-smarthr-1021020088552.asia-northeast1.run.app
```

3. 初回接続時にターミナルに認証 URL が表示される → ブラウザで開く
4. `y@lend.aozora-cg.com` を選択 → 認証完了
5. `claude` を起動し、`/mcp` コマンドでサーバーが「連携済み（connected）」になっていることを確認
6. チャット画面で「**従業員一覧** を見せて」などと依頼して動作確認

---

## 動作確認シナリオ

接続成功後、以下を試してください。**期待する挙動どおりなら正常**:

claude.ai の日本語 UI 上でのツール名 / 実際のツール ID 対応:

| claude.ai 表示名 | ツール ID | 期待動作 |
|-----------------|----------|---------|
| 従業員一覧 | `list_employees` | 成功（200）、従業員データが返る |
| 従業員詳細 | `get_employee` | 成功（200） |
| 部署一覧 | `list_departments` | 成功（200） |
| 従業員更新 | `update_employee` | **403 エラー**（readonly 強制、これが正しい動作） |
| 従業員登録 | `create_employee` | **403 エラー**（readonly 強制、これが正しい動作） |

いずれの接続方法でも、認証成功後は同じ挙動になるはず。給与明細機能は本 MCP サーバーでは未提供（完全排除済）。

---

## トラブルシューティング

### Google 認証画面で「アクセスが拒否されました（access_denied）」が表示される

- ログイン中の Google アカウントが `y@lend.aozora-cg.com` であるか確認
- 他のアカウントでログインしていないか確認（プライベートブラウジングで試す）
- claude.ai にまだ `y@lend.aozora-cg.com` でアカウントを作っていなければ、先に claude.ai でアカウント登録

### 連携（接続）直後に 403 エラーが返る

- 管理者（yasushi.honda@aozora-cg.com）に連絡
- Firestore `mcp-users` への登録、または環境変数 `EXTERNAL_READONLY_EMAIL_ALLOWLIST` の設定に問題がある可能性

### 書き込み/削除ツール（従業員登録・従業員更新）が実行できてしまう

- **セキュリティインシデント**として即座に管理者に連絡（readonly 強制が効いていない異常）

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
