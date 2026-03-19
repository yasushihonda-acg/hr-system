"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access-control";
import {
  deleteChatCredentials,
  getChatCredentials,
  getChatSyncConfig,
  getChatSyncStatus,
  triggerChatSync,
  updateChatSyncConfig,
} from "@/lib/api";
import type { ChatCredentialsInfo, SyncConfig, SyncStatus } from "@/lib/types";

export async function getSyncStatusAction(): Promise<{
  status: SyncStatus;
  config: SyncConfig;
}> {
  await requireAdmin();
  const [status, config] = await Promise.all([getChatSyncStatus(), getChatSyncConfig()]);
  return { status, config };
}

export async function triggerSyncAction(): Promise<{ message: string }> {
  await requireAdmin();
  const result = await triggerChatSync();
  revalidatePath("/admin/sync");
  return result;
}

export async function updateSyncConfigAction(updates: {
  intervalMinutes?: number;
  isEnabled?: boolean;
}): Promise<SyncConfig> {
  await requireAdmin();
  const result = await updateChatSyncConfig(updates);
  revalidatePath("/admin/sync");
  return result;
}

export async function getChatCredentialsAction(): Promise<ChatCredentialsInfo | null> {
  await requireAdmin();
  const result = await getChatCredentials();
  return result.data;
}

export async function disconnectChatAccountAction(): Promise<{ success: boolean }> {
  await requireAdmin();
  const result = await deleteChatCredentials();
  revalidatePath("/admin/sync");
  return result;
}
