"use server";

import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/access-control";
import {
  createManualTask,
  deleteManualTask,
  getChatMessage,
  getLineMessage,
  updateLineResponseStatus,
  updateLineTaskPriority,
  updateLineWorkflow,
  updateManualTask,
  updateResponseStatus,
  updateWorkflow,
} from "@/lib/api";
import type {
  ChatMessageDetail,
  LineMessageDetail,
  ManualTaskSummary,
  WorkflowSteps,
  WorkflowUpdateRequest,
} from "@/lib/types";

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

// --- 手動タスク CRUD アクション ---

export async function createManualTaskAction(body: {
  title: string;
  content?: string;
  taskPriority: TaskPriority;
  responseStatus?: ResponseStatus;
  category?: string | null;
  assignees?: string | null;
  deadline?: string | null;
}): Promise<ManualTaskSummary> {
  await requireAccess();
  const result = await createManualTask(body);
  revalidatePath("/task-board");
  return result;
}

export async function updateManualTaskAction(
  id: string,
  body: {
    title?: string;
    content?: string;
    taskPriority?: TaskPriority;
    responseStatus?: ResponseStatus;
    assignees?: string | null;
    deadline?: string | null;
  },
): Promise<ManualTaskSummary> {
  await requireAccess();
  const result = await updateManualTask(id, body);
  revalidatePath("/task-board");
  return result;
}

export async function deleteManualTaskAction(id: string): Promise<void> {
  await requireAccess();
  await deleteManualTask(id);
  revalidatePath("/task-board");
}

export async function fetchManualTaskDetailAction(id: string): Promise<ManualTaskSummary> {
  await requireAccess();
  return (await import("@/lib/api")).getManualTask(id);
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

export async function updateLineAssigneesFromTaskBoard(
  messageId: string,
  assignees: string | null,
) {
  await requireAccess();
  await updateLineWorkflow(messageId, { assignees });
  revalidatePath("/inbox");
  revalidatePath("/task-board");
}

export async function updateLineDeadlineFromTaskBoard(messageId: string, deadline: string | null) {
  await requireAccess();
  await updateLineWorkflow(messageId, { deadline });
  revalidatePath("/inbox");
  revalidatePath("/task-board");
}

export async function updateLineWorkflowFromTaskBoard(
  messageId: string,
  body: { workflowSteps?: WorkflowSteps; notes?: string | null },
) {
  await requireAccess();
  await updateLineWorkflow(messageId, body);
  revalidatePath("/inbox");
  revalidatePath("/task-board");
}

export async function updateManualWorkflowFromTaskBoard(
  id: string,
  body: { workflowSteps?: WorkflowSteps; notes?: string | null },
) {
  await requireAccess();
  await updateManualTask(id, body);
  revalidatePath("/task-board");
}

export async function updateChatAssigneesFromTaskBoard(
  chatMessageId: string,
  assignees: string | null,
) {
  await requireAccess();
  await updateWorkflow(chatMessageId, { assignees });
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}

export async function updateChatDeadlineFromTaskBoard(
  chatMessageId: string,
  deadline: string | null,
) {
  await requireAccess();
  await updateWorkflow(chatMessageId, { deadline });
  revalidatePath("/inbox");
  revalidatePath("/chat-messages");
  revalidatePath("/task-board");
}
