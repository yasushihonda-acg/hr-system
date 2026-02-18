import { CHANGE_TYPES, type ChangeType } from "@hr-system/shared";
import { getGenerativeModel } from "./gemini-client.js";
import { SALARY_PARAM_EXTRACTION_PROMPT } from "./prompts.js";

export interface SalaryChangeParams {
  employeeIdentifier: string | null;
  changeType: ChangeType;
  targetSalary: number | null;
  allowanceType: string | null;
  reasoning: string;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  return text.trim();
}

export async function extractSalaryParams(message: string): Promise<SalaryChangeParams> {
  const model = getGenerativeModel();
  const response = await model.generateContent({
    contents: [
      { role: "user", parts: [{ text: SALARY_PARAM_EXTRACTION_PROMPT }] },
      {
        role: "model",
        parts: [{ text: "理解しました。給与変更パラメータをJSON形式で抽出します。" }],
      },
      { role: "user", parts: [{ text: message }] },
    ],
  });

  const text = response.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error(`Parameter extraction failed: invalid JSON response: ${text}`);
  }

  const result = parsed as Record<string, unknown>;

  if (
    typeof result.changeType !== "string" ||
    !CHANGE_TYPES.includes(result.changeType as ChangeType)
  ) {
    throw new Error(`Parameter extraction failed: invalid changeType "${result.changeType}"`);
  }

  return {
    employeeIdentifier:
      typeof result.employeeIdentifier === "string" ? result.employeeIdentifier : null,
    changeType: result.changeType as ChangeType,
    targetSalary: typeof result.targetSalary === "number" ? result.targetSalary : null,
    allowanceType: typeof result.allowanceType === "string" ? result.allowanceType : null,
    reasoning: String(result.reasoning ?? ""),
  };
}
