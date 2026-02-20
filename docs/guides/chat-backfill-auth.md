# Chat REST API バックフィル — 認証セットアップガイド

`packages/db/src/seed/backfill-chat.ts` は `chat.messages.readonly` スコープが必要。
このガイドでは3つの認証方法とトラブルシューティングを説明する。

---

## 前提

- GCP プロジェクト: `hr-system-487809`
- 対象スペース: `AAAA-qf5jX0`（人事関連(全社共通)）
- スペースメンバー: `yasushi.honda@aozora-cg.com`

---

## 方法 A: GOOGLE_ACCESS_TOKEN（最速・推奨）

任意の方法で取得したアクセストークンを環境変数に渡す。

### A-1. Desktop OAuth クライアントを使う場合

1. [GCP Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=hr-system-487809) を開く
2. **CREATE CREDENTIALS → OAuth client ID → Desktop app** を選択
3. Name: `hr-backfill-cli` などで作成
4. `client_secret_xxx.json` をダウンロード
5. 以下のコマンドで ADC を取得:

```bash
gcloud auth application-default login \
  --client-id-file=/path/to/client_secret_xxx.json \
  --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/chat.messages.readonly"

# ADC トークンを取得
GOOGLE_ACCESS_TOKEN=$(gcloud auth application-default print-access-token)
GOOGLE_ACCESS_TOKEN=$GOOGLE_ACCESS_TOKEN pnpm --filter @hr-system/db db:backfill
```

> **備考**: Desktop クライアントは Workspace 管理者ポリシーの影響を受けやすいが、
> 組織の OAuth ポリシー設定によっては gcloud 組込みクライアントよりも通りやすい場合がある。

### A-2. oauth2l を使う場合（Desktop クライアント不要）

```bash
# oauth2l のインストール
go install github.com/google/oauth2l@latest
# or: brew install oauth2l

# token 取得（ブラウザでユーザー同意）
GOOGLE_ACCESS_TOKEN=$(oauth2l fetch --credentials /path/to/client_secret.json \
  chat.messages.readonly)

GOOGLE_ACCESS_TOKEN=$GOOGLE_ACCESS_TOKEN pnpm --filter @hr-system/db db:backfill
```

---

## 方法 B: DWD（Domain-Wide Delegation）

### 前提

サービスアカウント `hr-worker@hr-system-487809.iam.gserviceaccount.com` を使用。

### B-1. GCP Console で DWD を有効化

1. [IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=hr-system-487809) を開く
2. `hr-worker@...` をクリック
3. **ADVANCED SETTINGS** タブ → **Domain-wide delegation** セクション
4. **ENABLE G SUITE DOMAIN-WIDE DELEGATION** をチェック
5. **Product name**: `HR Backfill Tool` などを入力して保存
6. 表示される **Client ID**（数字のみ）をメモ（例: `123456789012345678901`）

### B-2. Google Workspace Admin Console でスコープを承認

1. [admin.google.com → Security → API controls](https://admin.google.com/ac/owl/domainwidedelegation) を開く
   （Workspace Super Admin 権限が必要）
2. **Add new** をクリック
3. Client ID: 上記でメモした数字を入力
4. Scopes: `https://www.googleapis.com/auth/chat.messages.readonly` を追加
5. **Authorize** をクリック

### B-3. SA キーを発行してバックフィル実行

```bash
# SA キーを一時的に生成（実行後は即削除すること）
gcloud iam service-accounts keys create /tmp/dwd-key.json \
  --iam-account=hr-worker@hr-system-487809.iam.gserviceaccount.com

# バックフィル実行
DWD_SA_KEY_FILE=/tmp/dwd-key.json \
DWD_SUBJECT=yasushi.honda@aozora-cg.com \
pnpm --filter @hr-system/db db:backfill

# 実行後は必ずキーを削除
KEY_ID=$(jq -r .private_key_id /tmp/dwd-key.json)
gcloud iam service-accounts keys delete "$KEY_ID" \
  --iam-account=hr-worker@hr-system-487809.iam.gserviceaccount.com --quiet
rm /tmp/dwd-key.json
```

---

## 方法 C: ADC（gcloud 組込みクライアント）

Workspace 管理者ポリシーで gcloud クライアントが信頼済みの場合のみ使用可能。

### C-1. 信頼済みアプリへの追加（Workspace Admin 必要）

1. [admin.google.com → Security → API controls → App access control](https://admin.google.com/ac/owl/list) を開く
2. **Add app → OAuth App Name Or Client ID** をクリック
3. gcloud の client ID `32555940559.apps.googleusercontent.com` を検索・追加
4. **Trusted** に設定

### C-2. ADC 取得とバックフィル実行

```bash
gcloud auth application-default login \
  --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/chat.messages.readonly"

pnpm --filter @hr-system/db db:backfill
```

---

## トラブルシューティング

| エラー | 原因 | 対処 |
|--------|------|------|
| `REQUEST_DENIED` / `403` | スコープ不足またはポリシーブロック | 方法 A または B を試す |
| `Only clients of type 'TVs...'` | WEB 型クライアントでデバイスフロー試行 | Desktop 型クライアントを作成 |
| `iam.serviceAccounts.getAccessToken` 権限エラー | SA 偽装のロールなし | `serviceAccountTokenCreator` を付与するか方法 A/B を使う |
| `PERMISSION_DENIED: DWD` | admin.google.com でスコープ未承認 | B-2 の手順を実行 |
| `invalid_grant` (JWT) | DWD が GCP Console で未有効化 | B-1 の手順を実行 |
| メッセージ 0 件 | スペース未参加 or フィルタ期間の問題 | `yasushi.honda@aozora-cg.com` がスペースのメンバーか確認 |

---

## 実行後の検証

```bash
# Firestore のドキュメント数確認（Firebase Console で確認するのが最も簡単）
# https://console.firebase.google.com/project/hr-system-487809/firestore/data/~2Fchat_messages

# ダッシュボードで確認
open http://localhost:3000/chat-messages
```

| 確認項目 | 期待値 |
|---------|--------|
| chatMessages 件数 | CSV 版（998件）以上 |
| threadName | null でないドキュメントが存在する |
| formattedContent | リッチテキストが含まれるドキュメントが存在する |
| mentionedUsers | annotations から正確に抽出されている |
