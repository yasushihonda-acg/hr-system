"use server";

import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/access-control";
import {
  reclassifyIntent,
  updateLineResponseStatus,
  updateLineTaskPriority,
  updateLineWorkflow,
  updateResponseStatus,
  updateWorkflow,
} from "@/lib/api";
import type { WorkflowUpdateRequest } from "@/lib/types";

export async function updateResponseStatusAction(
  chatMessageId: string,
  responseStatus: ResponseStatus,
) {
  await requireAccess();
  await updateResponseStatus(chatMessageId, responseStatus);
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}

export async function updateWorkflowAction(chatMessageId: string, body: WorkflowUpdateRequest) {
  await requireAccess();
  await updateWorkflow(chatMessageId, body);
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}

export async function updateTaskPriorityAction(
  chatMessageId: string,
  taskPriority: TaskPriority | null,
) {
  await requireAccess();
  await updateWorkflow(chatMessageId, { taskPriority });
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}

export async function updateLineResponseStatusAction(
  messageId: string,
  responseStatus: ResponseStatus,
) {
  await requireAccess();
  await updateLineResponseStatus(messageId, responseStatus);
  revalidatePath("/inbox");
  revalidatePath("/task-board");
}

export async function updateLineTaskPriorityAction(
  messageId: string,
  taskPriority: TaskPriority | null,
) {
  await requireAccess();
  await updateLineTaskPriority(messageId, taskPriority);
  revalidatePath("/inbox");
  revalidatePath("/task-board");
}

export async function updateChatAssigneesAction(chatMessageId: string, assignees: string | null) {
  await requireAccess();
  await updateWorkflow(chatMessageId, { assignees });
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}

export async function updateChatDeadlineAction(chatMessageId: string, deadline: string | null) {
  await requireAccess();
  await updateWorkflow(chatMessageId, { deadline });
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}

export async function updateLineAssigneesAction(messageId: string, assignees: string | null) {
  await requireAccess();
  await updateLineWorkflow(messageId, { assignees });
  revalidatePath("/inbox");
  revalidatePath("/task-board");
}

export async function updateLineDeadlineAction(messageId: string, deadline: string | null) {
  await requireAccess();
  await updateLineWorkflow(messageId, { deadline });
  revalidatePath("/inbox");
  revalidatePath("/task-board");
}

export async function updateChatCategoriesAction(chatMessageId: string, categories: string[]) {
  await requireAccess();
  await reclassifyIntent(chatMessageId, { categories });
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}

export async function updateLineCategoriesAction(messageId: string, categories: string[]) {
  await requireAccess();
  await updateLineWorkflow(messageId, { categories });
  revalidatePath("/inbox");
  revalidatePath("/task-board");
}

export async function updateLineNotesAction(messageId: string, notes: string | null) {
  await requireAccess();
  await updateLineWorkflow(messageId, { notes });
  revalidatePath("/inbox");
  revalidatePath("/task-board");
}

export async function updateChatNotesAction(chatMessageId: string, notes: string | null) {
  await requireAccess();
  await updateWorkflow(chatMessageId, { notes });
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}
