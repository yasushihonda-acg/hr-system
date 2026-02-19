#!/usr/bin/env bash
# ============================================================================
# Phase E: Workspace Events API サブスクリプション作成
#
# 前提条件:
#   1. 以下のいずれかで Chat API スコープの認証が完了していること:
#
#   [方法A] Admin Console で gcloud を信頼済みに設定した場合:
#     gcloud auth application-default login \
#       --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/chat.messages.readonly,https://www.googleapis.com/auth/chat.spaces.readonly"
#
#   [方法B] 専用 OAuth クライアントを作成した場合:
#     gcloud auth application-default login \
#       --client-id-file=client_secrets.json \
#       --scopes="https://www.googleapis.com/auth/chat.messages.readonly,https://www.googleapis.com/auth/chat.spaces.readonly"
#
# 実行:
#   bash scripts/setup-workspace-events.sh
# ============================================================================

set -euo pipefail

PROJECT_ID="hr-system-487809"
SPACE_NAME="spaces/AAAA-qf5jX0"
PUBSUB_TOPIC="projects/${PROJECT_ID}/topics/hr-chat-events"

echo "=== Workspace Events API サブスクリプション作成 ==="

# トークン取得
ACCESS_TOKEN=$(gcloud auth application-default print-access-token 2>/dev/null)
if [ -z "$ACCESS_TOKEN" ]; then
  echo "Error: ADC トークンが取得できません"
  echo "事前に gcloud auth application-default login を実行してください"
  exit 1
fi

# スコープ確認
SCOPES=$(curl -s "https://oauth2.googleapis.com/tokeninfo?access_token=${ACCESS_TOKEN}" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('scope',''))")
echo "現在のスコープ: $SCOPES"

if ! echo "$SCOPES" | grep -q "chat"; then
  echo "Error: Chat API スコープがありません"
  echo "必要なスコープ: chat.messages.readonly または chat.spaces.readonly"
  exit 1
fi

# 既存のサブスクリプション確認・削除
echo ""
echo "--- 既存サブスクリプション確認 ---"
EXISTING=$(curl -s \
  "https://workspaceevents.googleapis.com/v1/subscriptions?filter=target_resource%3D%22%2F%2Fchat.googleapis.com%2F${SPACE_NAME}%22" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-user-project: ${PROJECT_ID}")
echo "$EXISTING" | python3 -c "
import sys,json
d=json.load(sys.stdin)
subs = d.get('subscriptions', [])
print(f'{len(subs)} 件の既存サブスクリプション')
for s in subs:
  print(f'  - {s.get(\"name\", \"?\")} ({s.get(\"state\", \"?\")})')
"

# サブスクリプション作成
echo ""
echo "--- サブスクリプション作成 ---"
RESPONSE=$(curl -s -X POST \
  "https://workspaceevents.googleapis.com/v1/subscriptions" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: ${PROJECT_ID}" \
  -d "{
    \"targetResource\": \"//chat.googleapis.com/${SPACE_NAME}\",
    \"eventTypes\": [
      \"google.workspace.chat.message.v1.created\",
      \"google.workspace.chat.message.v1.updated\"
    ],
    \"notificationEndpoint\": {
      \"pubsubTopic\": \"${PUBSUB_TOPIC}\"
    },
    \"payloadOptions\": { \"includeResource\": true },
    \"ttl\": \"0s\"
  }")

echo "$RESPONSE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if 'error' in d:
  print(f'Error: {d[\"error\"][\"message\"]}')
  sys.exit(1)
op = d.get('name', '?')
print(f'Operation: {op}')
print('サブスクリプション作成リクエスト送信完了')
print('Note: includeResource=true の場合、TTL は最大4時間です')
print('定期的な更新が必要: scripts/renew-workspace-events.sh を参照')
"

# サブスクリプション一覧確認
echo ""
echo "--- サブスクリプション一覧 ---"
sleep 3
curl -s \
  "https://workspaceevents.googleapis.com/v1/subscriptions?filter=target_resource%3D%22%2F%2Fchat.googleapis.com%2F${SPACE_NAME}%22" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-user-project: ${PROJECT_ID}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
subs = d.get('subscriptions', [])
print(f'{len(subs)} 件のサブスクリプション')
for s in subs:
  print(f'  名前:    {s.get(\"name\", \"?\")}')
  print(f'  状態:    {s.get(\"state\", \"?\")}')
  print(f'  有効期限: {s.get(\"expireTime\", \"永続\")}')
  print()
"

echo "=== 完了 ==="
echo ""
echo "E2E 検証:"
echo "1. Google Chat スペース AAAA-qf5jX0 にメッセージを投稿"
echo "2. Cloud Run ログ確認:"
echo "   gcloud logging read 'resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"hr-worker\"' --project=${PROJECT_ID} --limit=20 --freshness=5m"
echo "3. Firestore Console でデータ保存確認:"
echo "   https://console.cloud.google.com/firestore/data/chat_messages?project=${PROJECT_ID}"
