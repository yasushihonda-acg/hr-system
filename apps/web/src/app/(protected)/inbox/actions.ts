"use server";

import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import { revalidatePath } from "next/cache";
import {
  updateLineResponseStatus,
  updateLineTaskPriority,
  updateResponseStatus,
  updateWorkflow,
} from "@/lib/api";
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

export async function updateTaskPriorityAction(
  chatMessageId: string,
  taskPriority: TaskPriority | null,
) {
  await updateWorkflow(chatMessageId, { taskPriority });
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

export async function updateLineTaskPriorityAction(
  messageId: string,
  taskPriority: TaskPriority | null,
) {
  await updateLineTaskPriority(messageId, taskPriority);
  revalidatePath("/inbox");
}
