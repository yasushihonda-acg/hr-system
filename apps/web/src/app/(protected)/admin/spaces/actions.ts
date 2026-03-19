"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access-control";
import {
  createChatSpace,
  deleteChatCredentials,
  deleteChatSpace,
  deleteLineGroup,
  getChatCredentials,
  updateChatSpace,
  updateLineGroup,
} from "@/lib/api";
import type { ChatCredentialsInfo } from "@/lib/types";

export async function addSpaceAction(formData: FormData) {
  await requireAdmin();
  const spaceId = formData.get("spaceId") as string;
  const displayName = formData.get("displayName") as string;
  await createChatSpace({ spaceId, displayName });
  revalidatePath("/admin/spaces");
}

export async function toggleSpaceActiveAction(id: string, isActive: boolean) {
  await requireAdmin();
  await updateChatSpace(id, { isActive });
  revalidatePath("/admin/spaces");
}

export async function deleteSpaceAction(id: string) {
  await requireAdmin();
  await deleteChatSpace(id);
  revalidatePath("/admin/spaces");
}

// --- Chat Credentials Actions ---

export async function getChatCredentialsAction(): Promise<ChatCredentialsInfo | null> {
  await requireAdmin();
  const result = await getChatCredentials();
  return result.data;
}

export async function disconnectChatAccountAction(): Promise<{ success: boolean }> {
  await requireAdmin();
  const result = await deleteChatCredentials();
  revalidatePath("/admin/spaces");
  return result;
}

// --- LINE Group Actions ---

export async function toggleLineGroupActiveAction(id: string, isActive: boolean) {
  await requireAdmin();
  await updateLineGroup(id, { isActive });
  revalidatePath("/admin/spaces");
}

export async function deleteLineGroupAction(id: string) {
  await requireAdmin();
  await deleteLineGroup(id);
  revalidatePath("/admin/spaces");
}
