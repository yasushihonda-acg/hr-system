"use server";

import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/access-control";
import {
  getChatMessage,
  getLineMessage,
  updateLineResponseStatus,
  updateLineTaskPriority,
  updateResponseStatus,
  updateWorkflow,
} from "@/lib/api";
import type { ChatMessageDetail, LineMessageDetail, WorkflowUpdateRequest } from "@/lib/types";

/** Chat メッセージの詳細を取得 */
export async function fetchChatMessageDetailAction(id: string): Promise<ChatMessageDetail> {
  await requireAccess();
  return getChatMessage(id);
}

/** LINE メッセージの詳細を取得 */
export async function fetchLineMessageDetailAction(id: string): Promise<LineMessageDetail> {
  await requireAccess();
  return getLineMessage(id);
}

// --- 更新アクション（task-board でも revalidate する版） ---

export async function updateResponseStatusFromTaskBoard(
  chatMessageId: string,
  responseStatus: ResponseStatus,
) {
  await requireAccess();
  await updateResponseStatus(chatMessageId, responseStatus);
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}

export async function updateTaskPriorityFromTaskBoard(
  chatMessageId: string,
  taskPriority: TaskPriority | null,
) {
  await requireAccess();
  await updateWorkflow(chatMessageId, { taskPriority });
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}

export async function updateWorkflowFromTaskBoard(
  chatMessageId: string,
  body: WorkflowUpdateRequest,
) {
  await requireAccess();
  await updateWorkflow(chatMessageId, body);
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}

export async function updateLineResponseStatusFromTaskBoard(
  messageId: string,
  responseStatus: ResponseStatus,
) {
  await requireAccess();
  await updateLineResponseStatus(messageId, responseStatus);
  revalidatePath("/inbox");
  revalidatePath("/task-board");
}

export async function updateLineTaskPriorityFromTaskBoard(
  messageId: string,
  taskPriority: TaskPriority | null,
) {
  await requireAccess();
  await updateLineTaskPriority(messageId, taskPriority);
  revalidatePath("/inbox");
  revalidatePath("/task-board");
}
