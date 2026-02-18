import type { ActorRole, ChangeType, DraftStatus } from "@hr-system/shared";

/** GET /api/salary-drafts レスポンスの1件 */
export interface DraftSummary {
  id: string;
  employeeId: string;
  chatMessageId: string | null;
  status: DraftStatus;
  changeType: ChangeType;
  reason: string;
  beforeBaseSalary: number;
  afterBaseSalary: number;
  beforeTotal: number;
  afterTotal: number;
  effectiveDate: string;
  aiConfidence: number | null;
  aiReasoning: string | null;
  appliedRules: string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/salary-drafts/:id レスポンス */
export interface DraftDetail extends DraftSummary {
  items: DraftItem[];
  approvalLogs: ApprovalLogEntry[];
  nextActions: DraftStatus[];
}

export interface DraftItem {
  id: string;
  draftId: string;
  category: string;
  beforeValue: number;
  afterValue: number;
}

export interface ApprovalLogEntry {
  id: string;
  action: string;
  fromStatus: DraftStatus;
  toStatus: DraftStatus;
  actorEmail: string;
  actorRole: ActorRole;
  comment: string | null;
  modifiedFields: Record<string, unknown> | null;
  createdAt: string;
}

/** GET /api/employees レスポンスの1件 */
export interface EmployeeSummary {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  employmentType: string;
  department: string;
  position: string;
  hireDate: string;
  isActive: boolean;
}

/** GET /api/audit-logs レスポンスの1件 */
export interface AuditLogEntry {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorEmail: string;
  actorRole: ActorRole;
  details: Record<string, unknown>;
  createdAt: string;
}
