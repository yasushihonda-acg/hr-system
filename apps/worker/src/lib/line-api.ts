import { messagingApi } from "@line/bot-sdk";

let client: messagingApi.MessagingApiClient | null = null;

function getClient(): messagingApi.MessagingApiClient {
  if (!client) {
    client = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
    });
  }
  return client;
}

/** グループメンバーのプロフィール取得（displayName） */
export async function getGroupMemberProfile(
  groupId: string,
  userId: string,
): Promise<string | null> {
  try {
    const profile = await getClient().getGroupMemberProfile(groupId, userId);
    return profile.displayName;
  } catch (e) {
    console.warn(`[LineApi] getGroupMemberProfile failed: ${String(e)}`);
    return null;
  }
}

/** グループ名取得 */
export async function getGroupSummary(groupId: string): Promise<string | null> {
  try {
    const summary = await getClient().getGroupSummary(groupId);
    return summary.groupName;
  } catch (e) {
    console.warn(`[LineApi] getGroupSummary failed: ${String(e)}`);
    return null;
  }
}
