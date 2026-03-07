"use server";

import type { ResponseStatus } from "@hr-system/shared";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/access-control";
import { updateResponseStatus, updateWorkflow } from "@/lib/api";
import type { WorkflowUpdateRequest } from "@/lib/types";

export async function updateResponseStatusAction(
  chatMessageId: string,
  responseStatus: ResponseStatus,
) {
  await requireAccess();
  await updateResponseStatus(chatMessageId, responseStatus);
  revalidatePath(`/chat-messages/${chatMessageId}`);
  revalidatePath("/chat-messages");
}

export async function updateWorkflowAction(chatMessageId: string, body: WorkflowUpdateRequest) {
  await requireAccess();
  await updateWorkflow(chatMessageId, body);
  revalidatePath(`/chat-messages/${chatMessageId}`);
  revalidatePath("/chat-messages");
}
