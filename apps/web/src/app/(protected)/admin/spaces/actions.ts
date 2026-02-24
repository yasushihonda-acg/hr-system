"use server";

import { revalidatePath } from "next/cache";
import { createChatSpace, deleteChatSpace, updateChatSpace } from "@/lib/api";

export async function addSpaceAction(formData: FormData) {
  const spaceId = formData.get("spaceId") as string;
  const displayName = formData.get("displayName") as string;
  await createChatSpace({ spaceId, displayName });
  revalidatePath("/admin/spaces");
}

export async function toggleSpaceActiveAction(id: string, isActive: boolean) {
  await updateChatSpace(id, { isActive });
  revalidatePath("/admin/spaces");
}

export async function deleteSpaceAction(id: string) {
  await deleteChatSpace(id);
  revalidatePath("/admin/spaces");
}
