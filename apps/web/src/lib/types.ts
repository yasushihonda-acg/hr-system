import type {
  ActorRole,
  ChangeType,
  DraftStatus,
  WorkflowStepStatus,
  WorkflowSteps,
} from "@hr-system/shared";

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

// --- Classification Rules ---

export interface ClassificationRule {
  id: string;
  category: string;
  keywords: string[];
  excludeKeywords: string[];
  patterns: string[];
  priority: number;
  description: string;
  isActive: boolean;
  sampleMessages: string[];
  createdAt: string;
  updatedAt: string;
}

/** LLM 分類ルール */
export interface LlmClassificationRule {
  id: string;
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
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** テスト分類結果 */
export interface TestClassificationResult {
  category: string;
  confidence: number;
  reasoning: string;
  classificationMethod: "ai" | "regex";
  regexPattern: string | null;
}

// --- Stats ---

export interface StatsSummary {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
}

export interface CategoryStat {
  category: string;
  label: string;
  count: number;
  percentage: number;
}

export interface TimelinePoint {
  date: string;
  count: number;
}

export interface SpaceStat {
  spaceId: string;
  count: number;
}

// --- Admin Users ---

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Intent 分類結果（一覧・詳細共通） */
export interface IntentSummary {
  id: string;
  category: string;
  confidenceScore: number;
  classificationMethod: "ai" | "regex" | "manual";
  regexPattern: string | null;
  isManualOverride: boolean;
  originalCategory: string | null;
  responseStatus: "unresponded" | "in_progress" | "responded" | "not_required";
  taskSummary: string | null;
  assignees: string | null;
  notes: string | null;
  workflowSteps: WorkflowSteps | null;
  workflowUpdatedBy: string | null;
  workflowUpdatedAt: string | null;
  createdAt: string;
}

/** Intent 詳細（/api/chat-messages/:id に含まれる） */
export interface IntentDetail extends IntentSummary {
  reasoning: string | null;
  overriddenBy: string | null;
  overriddenAt: string | null;
  responseStatusUpdatedBy: string | null;
  responseStatusUpdatedAt: string | null;
}

/** PATCH /api/chat-messages/:id/workflow リクエスト */
export interface WorkflowUpdateRequest {
  taskSummary?: string | null;
  assignees?: string | null;
  notes?: string | null;
  workflowSteps?: WorkflowSteps;
}

export type { WorkflowStepStatus, WorkflowSteps };

export interface ChatAnnotation {
  type: "USER_MENTION" | "SLASH_COMMAND" | "RICH_LINK" | "UNKNOWN";
  startIndex?: number;
  length?: number;
  userMention?: { user: { name: string; displayName: string; type: string } };
  slashCommand?: { commandId: string; commandName: string };
  richLink?: { uri: string; title?: string };
}

export interface ChatAttachment {
  name: string;
  contentName?: string;
  contentType?: string;
  downloadUri?: string;
  source?: "DRIVE_FILE" | "UPLOADED_CONTENT";
}

/** GET /api/chat-messages の1件 */
export interface ChatMessageSummary {
  id: string;
  spaceId: string;
  googleMessageId: string;
  senderUserId: string;
  senderName: string;
  senderType: "HUMAN" | "BOT";
  content: string;
  formattedContent: string | null;
  messageType: "MESSAGE" | "THREAD_REPLY";
  threadName: string | null;
  parentMessageId: string | null;
  mentionedUsers: Array<{ userId: string; displayName: string }>;
  annotations: ChatAnnotation[];
  attachments: ChatAttachment[];
  isEdited: boolean;
  isDeleted: boolean;
  processedAt: string | null;
  createdAt: string;
  intent: IntentSummary | null;
}

// --- Intent Stats ---

export interface IntentStatsSummary {
  total: number;
  byMethod: { ai: number; regex: number; manual: number };
  overrideCount: number;
  overrideRate: number;
  avgConfidence: { ai: number | null; regex: number | null };
}

export interface ConfusionMatrixEntry {
  from: string;
  to: string;
  count: number;
}

export interface ConfidenceTimelinePoint {
  date: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface OverrideRatePoint {
  date: string;
  total: number;
  overrides: number;
  overrideRate: number;
}

export interface OverridePattern {
  fromCategory: string;
  toCategory: string;
  count: number;
  percentage: number;
  sampleMessages: Array<{ id: string; content: string }>;
  suggestedKeywords: string[];
}

/** 同期設定 */
export interface SyncConfig {
  intervalMinutes: number;
  isEnabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** 同期ステータス */
export interface SyncStatus {
  status: "idle" | "running" | "error";
  lastSyncedAt: string | null;
  lastResult: {
    newMessages: number;
    duplicateSkipped: number;
    durationMs: number;
    syncedAt: string;
  } | null;
  errorMessage: string | null;
}

/** チャットスペース設定 */
export interface ChatSpaceConfig {
  id: string;
  spaceId: string;
  displayName: string;
  isActive: boolean;
  addedBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/chat-messages/:id */
export interface ChatMessageDetail extends ChatMessageSummary {
  rawPayload: Record<string, unknown> | null;
  intent: IntentDetail | null;
  threadMessages: Array<{
    id: string;
    senderName: string;
    content: string;
    formattedContent: string | null;
    messageType: "MESSAGE" | "THREAD_REPLY";
    mentionedUsers: Array<{ userId: string; displayName: string }>;
    createdAt: string;
  }>;
}
