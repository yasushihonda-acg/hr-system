import type {
  ActorRole,
  ChangeType,
  DraftStatus,
  ResponseStatus,
  SalaryItemType,
  TaskPriority,
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
  reason: string | null;
  beforeBaseSalary: number;
  afterBaseSalary: number;
  beforeTotal: number;
  afterTotal: number;
  effectiveDate: string;
  aiConfidence: number | null;
  aiReasoning: string | null;
  appliedRules: Record<string, unknown> | null;
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
  itemType: SalaryItemType;
  itemName: string;
  beforeAmount: number;
  afterAmount: number;
  isChanged: boolean;
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
  email: string | null;
  employmentType: string;
  department: string | null;
  position: string | null;
  hireDate: string;
  isActive: boolean;
}

/** GET /api/employees/:id レスポンス */
export interface EmployeeDetail extends EmployeeSummary {
  googleChatUserId: string | null;
  createdAt: string;
  updatedAt: string;
  currentSalary: {
    id: string;
    baseSalary: number;
    positionAllowance: number;
    regionAllowance: number;
    qualificationAllowance: number;
    otherAllowance: number;
    totalSalary: number;
    effectiveFrom: string;
  } | null;
}

/** GET /api/audit-logs レスポンスの1件 */
export interface AuditLogEntry {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorEmail: string | null;
  actorRole: ActorRole | null;
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
  displayName: string;
  count: number;
  source?: string;
}

// --- Admin Users ---

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  addedBy: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Intent 分類結果（一覧・詳細共通） */
export interface IntentSummary {
  id: string;
  categories: string[];
  confidenceScore: number;
  classificationMethod: "ai" | "regex" | "manual";
  regexPattern: string | null;
  isManualOverride: boolean;
  originalCategories: string[] | null;
  responseStatus: "unresponded" | "in_progress" | "responded" | "not_required";
  taskPriority: TaskPriority | null;
  taskSummary: string | null;
  assignees: string | null;
  deadline: string | null;
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
  taskPriority?: TaskPriority | null;
  taskSummary?: string | null;
  assignees?: string | null;
  deadline?: string | null;
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
  spaceDisplayName: string | null;
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

/** LINE グループ設定 */
export interface LineGroupConfig {
  id: string;
  groupId: string;
  displayName: string;
  isActive: boolean;
  addedBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- LINE Messages ---

/** GET /api/line-messages の1件 */
export interface LineMessageSummary {
  id: string;
  groupId: string;
  groupName: string | null;
  senderUserId: string;
  senderName: string;
  content: string;
  contentUrl: string | null;
  lineMessageType: string;
  taskPriority: TaskPriority | null;
  assignees: string | null;
  deadline: string | null;
  responseStatus: ResponseStatus;
  categories: string[];
  workflowSteps: WorkflowSteps | null;
  notes: string | null;
  createdAt: string;
}

/** GET /api/line-messages/:id の詳細レスポンス */
export interface LineMessageDetail extends LineMessageSummary {
  lineMessageId: string;
  responseStatusUpdatedBy: string | null;
  responseStatusUpdatedAt: string | null;
  rawPayload: Record<string, unknown> | null;
}

/** 受信箱統合ビュー: Google Chat + LINE の共通型 */
export type UnifiedMessageSummary =
  | (ChatMessageSummary & { source: "gchat" })
  | (LineMessageSummary & { source: "line" });

/** 受信箱統合ビュー: 詳細型 */
export type UnifiedMessageDetail =
  | (ChatMessageDetail & { source: "gchat" })
  | (LineMessageDetail & { source: "line" });

/** GET /api/line-messages/stats のグループ統計 */
export interface LineGroupStat {
  groupId: string;
  groupName: string | null;
  count: number;
}

/** GET /api/line-messages/group-freshness のグループ鮮度情報 */
export interface LineGroupFreshness {
  groupId: string;
  groupName: string;
  isActive: boolean;
  lastMessageAt: string | null;
}

/** GET /api/manual-tasks の1件 */
export interface ManualTaskSummary {
  id: string;
  title: string;
  content: string;
  taskPriority: TaskPriority;
  responseStatus: ResponseStatus;
  categories: string[];
  assignees: string | null;
  deadline: string | null;
  workflowSteps: WorkflowSteps | null;
  notes: string | null;
  createdBy: string;
  createdByName: string;
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

/** Chat API 連携アカウント情報（トークンを含まない安全な型） */
export interface ChatCredentialsInfo {
  email: string;
  connectedBy: string | null;
  connectedAt: string | null;
  source?: "oauth" | "adc";
}
