#!/usr/bin/env bash
# ============================================================================
# Phase A: Worker ローカル E2E 検証スクリプト
#
# 使い方:
#   1. Firebase Emulator を起動:  pnpm emulator
#   2. Worker を別ターミナルで起動:
#      PUBSUB_SKIP_AUTH=true FIRESTORE_EMULATOR_HOST=localhost:8080 \
#      GCP_PROJECT_ID=hr-system-487809 \
#      pnpm --filter @hr-system/worker dev
#   3. 本スクリプトを実行: bash scripts/test-worker-local.sh
#
# 確認ポイント:
#   - Emulator UI (http://localhost:4000) の chat_messages コレクション
#   - Emulator UI の intent_records コレクション
#   - Emulator UI の audit_logs コレクション
# ============================================================================

set -euo pipefail

WORKER_URL="${WORKER_URL:-http://localhost:3002}"
SPACE_NAME="spaces/AAAA-qf5jX0"
MESSAGE_ID="${1:-test-msg-$(date +%s)}"

echo "=== Worker ローカル E2E テスト ==="
echo "Worker URL: ${WORKER_URL}"
echo "Message ID: ${MESSAGE_ID}"
echo ""

# ---------------------------------------------------------------------------
# Chat イベントペイロードを base64 エンコード
# ---------------------------------------------------------------------------
CHAT_PAYLOAD=$(cat <<EOF
{
  "message": {
    "name": "${SPACE_NAME}/messages/${MESSAGE_ID}",
    "sender": {
      "name": "users/test-user-001",
      "type": "HUMAN",
      "displayName": "田中 テスト"
    },
    "text": "山田さんの給与を2ピッチ上げてください",
    "createTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "space": { "name": "${SPACE_NAME}" },
    "thread": {
      "name": "${SPACE_NAME}/threads/thread-001",
      "threadReply": false
    }
  }
}
EOF
)

ENCODED_DATA=$(echo -n "$CHAT_PAYLOAD" | base64)

# ---------------------------------------------------------------------------
# Pub/Sub push ボディ
# ---------------------------------------------------------------------------
PUBSUB_BODY=$(cat <<EOF
{
  "message": {
    "data": "${ENCODED_DATA}",
    "messageId": "pubsub-${MESSAGE_ID}",
    "publishTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "attributes": {
      "ce-type": "google.workspace.chat.message.v1.created",
      "ce-source": "//chat.googleapis.com/${SPACE_NAME}"
    }
  },
  "subscription": "projects/hr-system-487809/subscriptions/hr-chat-events-push"
}
EOF
)

echo "--- テスト 1: 通常メッセージ送信 ---"
RESPONSE=$(curl -s -o /tmp/worker-response.json -w "%{http_code}" \
  -X POST "${WORKER_URL}/pubsub/push" \
  -H "Content-Type: application/json" \
  -d "$PUBSUB_BODY")

echo "HTTP Status: ${RESPONSE}"
echo "Response:"
cat /tmp/worker-response.json
echo ""

if [ "$RESPONSE" = "200" ]; then
  echo "✓ テスト 1 成功: 正常メッセージが処理されました"
else
  echo "✗ テスト 1 失敗: HTTP ${RESPONSE}"
fi

echo ""
echo "--- テスト 2: 重複メッセージ（同じ MESSAGE_ID を再送） ---"
RESPONSE2=$(curl -s -o /tmp/worker-response2.json -w "%{http_code}" \
  -X POST "${WORKER_URL}/pubsub/push" \
  -H "Content-Type: application/json" \
  -d "$PUBSUB_BODY")

echo "HTTP Status: ${RESPONSE2}"
cat /tmp/worker-response2.json
echo ""

if [ "$RESPONSE2" = "200" ]; then
  echo "✓ テスト 2 成功: 重複メッセージが ACK されました（スキップ期待）"
else
  echo "✗ テスト 2 失敗: HTTP ${RESPONSE2}"
fi

echo ""
echo "--- テスト 3: Bot 投稿（無視されること） ---"
BOT_PAYLOAD=$(echo -n "${CHAT_PAYLOAD}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
d['message']['sender']['type'] = 'BOT'
d['message']['name'] = '${SPACE_NAME}/messages/bot-msg-${MESSAGE_ID}'
print(json.dumps(d))
" 2>/dev/null || echo "$CHAT_PAYLOAD" | sed 's/"HUMAN"/"BOT"/;s|messages/'"${MESSAGE_ID}"'|messages/bot-'"${MESSAGE_ID}"'|')
BOT_ENCODED=$(echo -n "$BOT_PAYLOAD" | base64)
BOT_BODY=$(echo "$PUBSUB_BODY" | sed "s|\"data\": \"${ENCODED_DATA}\"|\"data\": \"${BOT_ENCODED}\"|")

RESPONSE3=$(curl -s -o /tmp/worker-response3.json -w "%{http_code}" \
  -X POST "${WORKER_URL}/pubsub/push" \
  -H "Content-Type: application/json" \
  -d "$BOT_BODY")

echo "HTTP Status: ${RESPONSE3}"
cat /tmp/worker-response3.json
echo ""

if [ "$RESPONSE3" = "200" ]; then
  echo "✓ テスト 3 成功: Bot 投稿が ACK されました（Firestore には保存されないこと）"
else
  echo "✗ テスト 3 失敗: HTTP ${RESPONSE3}"
fi

echo ""
echo "--- テスト 4: ヘルスチェック ---"
HEALTH=$(curl -s "${WORKER_URL}/health")
echo "Health: $HEALTH"
echo ""

echo "=== 検証手順 ==="
echo "1. http://localhost:4000 を開く"
echo "2. Firestore エミュレータで以下を確認:"
echo "   - chat_messages コレクション: '山田さんの給与...' のメッセージが保存されていること"
echo "   - intent_records コレクション: category='salary' の IntentRecord が作成されていること"
echo "   - audit_logs コレクション: chat_received, intent_classified のログが作成されていること"
echo "3. 重複メッセージは Firestore に追加されていないこと（1件のみ）"
