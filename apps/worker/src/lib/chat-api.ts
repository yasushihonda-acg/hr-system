import { chat_v1 } from "@googleapis/chat";
import { GoogleAuth } from "google-auth-library";

/**
 * Chat REST API クライアントインターフェース（テスト用 DI 注入可能）
 */
export interface ChatApiClient {
  getMessage(messageName: string): Promise<chat_v1.Schema$Message | null>;
  getMember(memberName: string): Promise<chat_v1.Schema$Membership | null>;
}

/**
 * ADC 認証を使用した Chat API クライアントを生成する
 */
export function createChatApiClient(): ChatApiClient {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/chat.bot"],
  });
  const client = new chat_v1.Chat({ auth });

  return {
    async getMessage(messageName: string): Promise<chat_v1.Schema$Message | null> {
      try {
        const response = await client.spaces.messages.get({ name: messageName });
        return response.data ?? null;
      } catch (e) {
        console.warn(`[ChatApi] getMessage failed for ${messageName}: ${String(e)}`);
        return null;
      }
    },

    async getMember(memberName: string): Promise<chat_v1.Schema$Membership | null> {
      try {
        const response = await client.spaces.members.get({ name: memberName });
        return response.data ?? null;
      } catch (e) {
        console.warn(`[ChatApi] getMember failed for ${memberName}: ${String(e)}`);
        return null;
      }
    },
  };
}
