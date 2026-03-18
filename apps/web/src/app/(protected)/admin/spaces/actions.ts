"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access-control";
import {
  createChatSpace,
  deleteChatSpace,
  deleteLineGroup,
  updateChatSpace,
  updateLineGroup,
} from "@/lib/api";

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
