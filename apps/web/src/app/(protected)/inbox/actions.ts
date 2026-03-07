"use server";

import type { ResponseStatus } from "@hr-system/shared";
import { revalidatePath } from "next/cache";
import { updateLineResponseStatus, updateResponseStatus, updateWorkflow } from "@/lib/api";
import type { WorkflowUpdateRequest } from "@/lib/types";

export async function updateResponseStatusAction(
  chatMessageId: string,
  responseStatus: ResponseStatus,
) {
  await updateResponseStatus(chatMessageId, responseStatus);
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
}

export async function updateWorkflowAction(chatMessageId: string, body: WorkflowUpdateRequest) {
  await updateWorkflow(chatMessageId, body);
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
}

export async function updateLineResponseStatusAction(
  messageId: string,
  responseStatus: ResponseStatus,
) {
  await updateLineResponseStatus(messageId, responseStatus);
  revalidatePath("/inbox");
}
