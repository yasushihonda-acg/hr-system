import { WORKFLOW_STEP_STATUSES } from "@hr-system/shared";
import { z } from "zod";

export const workflowStepStatusSchema = z.enum(WORKFLOW_STEP_STATUSES);

export const workflowStepsSchema = z.object({
  salaryListReflection: workflowStepStatusSchema,
  smartHRReflection: workflowStepStatusSchema,
  noticeExecution: workflowStepStatusSchema,
  laborLawyerShare: workflowStepStatusSchema,
});
