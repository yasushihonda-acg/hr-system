"use server";

import { revalidatePath } from "next/cache";
import { updateResponseStatus, updateWorkflow } from "@/lib/api";
import type { WorkflowUpdateRequest } from "@/lib/types";

export async function updateResponseStatusAction(
  chatMessageId: string,
  responseStatus: "unresponded" | "in_progress" | "responded" | "not_required",
) {
  await updateResponseStatus(chatMessageId, responseStatus);
  revalidatePath(`/chat-messages/${chatMessageId}`);
  revalidatePath("/chat-messages");
}

export async function updateWorkflowAction(chatMessageId: string, body: WorkflowUpdateRequest) {
  await updateWorkflow(chatMessageId, body);
  revalidatePath(`/chat-messages/${chatMessageId}`);
  revalidatePath("/chat-messages");
}
