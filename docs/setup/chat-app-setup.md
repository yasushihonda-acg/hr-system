# Google Chat App セットアップガイド

Phase E: Google Chat スペースからメッセージを受信するための Chat App 設定手順。

## 背景

Workspace Events API を使用する方法（`scripts/setup-workspace-events.sh`）は
`chat.messages.readonly` などのセンシティブスコープが必要で、Workspace 管理者の承認が必要。

**代替案**: Google Chat App を Pub/Sub 接続タイプで作成し、スペースに招待する方法。
これによりユーザー OAuth 不要で、サービスアカウントのみで動作する。

---

## セットアップ手順

### Step 1: Chat API 設定ページを開く

GCP Console → Google Chat API → 設定:

```
https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=hr-system-487809
```

### Step 2: Chat App を設定

以下の項目を入力:

| 項目 | 値 |
|------|-----|
| **アプリ名** | HR AI Agent |
| **アバター URL** | *(任意)* |
| **説明** | 人事指示を自動処理する AI エージェント |
| **機能** | スペースとグループの会話でボットを有効にする ✅ |

### Step 3: 接続設定

| 項目 | 値 |
|------|-----|
| **接続設定** | Cloud Pub/Sub |
| **Cloud Pub/Sub トピック** | `projects/hr-system-487809/topics/hr-chat-events` |

> **注意**: Pub/Sub トピックに Chat API サービスアカウントのパブリッシュ権限が必要（後述）

### Step 4: 権限設定

「アプリがアクセスできる場所」で以下を有効化:

- ✅ **特定ドメイン内のすべてのユーザーに提供**: `aozora-cg.com`（または組織ドメイン）

### Step 5: 変更を保存

「変更を保存」をクリック。**アプリメールアドレス**が表示される（例: `hr-ai-agent@xxx.iam.gserviceaccount.com`）。

---

## Pub/Sub 権限の追加

Chat API の内部サービスアカウントがトピックにパブリッシュできるよう権限を付与:

```bash
# Chat API が使用するサービスアカウントへのパブリッシュ権限
gcloud pubsub topics add-iam-policy-binding hr-chat-events \
  --member='serviceAccount:chat-api-push@system.gserviceaccount.com' \
  --role='roles/pubsub.publisher' \
  --project=hr-system-487809
```

> Workspace Events API と同じトピック `hr-chat-events` を使用するため、
> すでに権限が付与されている場合はスキップ。

---

## スペースへの招待

1. Google Chat を開く
2. スペース `AAAA-qf5jX0`（人事関連スペース）を開く
3. スペース名をクリック → 「メンバーを追加」
4. **HR AI Agent** を検索して追加

---

## 「全メッセージを受信」の設定

デフォルトでは Chat App は @メンションのみ受信。
**全メッセージを受信する**には、スペース管理者がスペース設定を変更する必要がある:

1. スペース設定 → 「管理」 → 「ボット」
2. HR AI Agent の設定で「すべてのメッセージを受信」を有効化

> もし管理権限がない場合は、Workspace Events API（`setup-workspace-events.sh`）を
> Workspace 管理者に依頼して実行してもらう方法を検討する。

---

## イベント形式の違い

Worker の `event-parser.ts` は両方の形式に対応済み:

| 形式 | `type` フィールド | `ce-type` 属性 |
|------|-----------------|---------------|
| Workspace Events API | なし | `google.workspace.chat.message.v1.created` 等 |
| Chat App (Pub/Sub) | `MESSAGE` / `ADDED_TO_SPACE` 等 | なし |

Chat App の `ADDED_TO_SPACE`, `REMOVED_FROM_SPACE`, `CARD_CLICKED` は
自動的に ACK（無処理）される。

---

## E2E 検証

Chat App の設定が完了したら:

1. スペース `AAAA-qf5jX0` にテストメッセージを投稿:
   ```
   山田さんの給与を2ピッチ上げてください
   ```

2. Cloud Run ログ確認（1〜2 分以内に届くはず）:
   ```bash
   gcloud logging read \
     'resource.type="cloud_run_revision" AND resource.labels.service_name="hr-worker"' \
     --project=hr-system-487809 \
     --limit=20 \
     --freshness=5m
   ```

3. Firestore Console でデータ保存確認:
   - `chat_messages`: メッセージ保存
   - `intent_records`: `category=salary` で分類
   - `salary_drafts`: 給与変更ドラフト生成
