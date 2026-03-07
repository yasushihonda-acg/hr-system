"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access-control";
import { createLlmRule, deleteLlmRule, updateLlmRule } from "@/lib/api";

export async function createLlmRuleAction(data: {
  type: "system_prompt" | "few_shot_example" | "category_definition";
  content: string | null;
  category: string | null;
  description: string | null;
  keywords: string[] | null;
  inputText: string | null;
  expectedCategory: string | null;
  explanation: string | null;
  priority: number;
  isActive: boolean;
}) {
  await requireAdmin();
  await createLlmRule(data);
  revalidatePath("/ai-settings");
}

export async function updateLlmRuleAction(id: string, data: Record<string, unknown>) {
  await requireAdmin();
  await updateLlmRule(id, data);
  revalidatePath("/ai-settings");
}

export async function deleteLlmRuleAction(id: string) {
  await requireAdmin();
  await deleteLlmRule(id);
  revalidatePath("/ai-settings");
}
