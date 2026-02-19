"use server";

import { revalidatePath } from "next/cache";
import { updateResponseStatus } from "@/lib/api";

export async function updateResponseStatusAction(
  chatMessageId: string,
  responseStatus: "unresponded" | "in_progress" | "responded" | "not_required",
) {
  await updateResponseStatus(chatMessageId, responseStatus);
  revalidatePath(`/chat-messages/${chatMessageId}`);
  revalidatePath("/chat-messages");
}
