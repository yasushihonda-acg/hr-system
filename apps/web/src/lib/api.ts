import type { DraftStatus } from "@hr-system/shared";
import { auth } from "@/auth";
import type {
  AdminUser,
  AuditLogEntry,
  CategoryStat,
  ChatMessageDetail,
  ChatMessageSummary,
  ClassificationRule,
  ConfidenceTimelinePoint,
  ConfusionMatrixEntry,
  DraftDetail,
  DraftSummary,
  EmployeeSummary,
  IntentStatsSummary,
  LlmClassificationRule,
  OverridePattern,
  OverrideRatePoint,
  SpaceStat,
  StatsSummary,
  SyncStatus,
  TestClassificationResult,
  TimelinePoint,
} from "@/lib/types";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getIdToken(): Promise<string> {
  const session = await auth();
  if (!session?.idToken) {
    throw new ApiError(401, "認証されていません");
  }
  return session.idToken;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await getIdToken();
  const url = `${API_BASE_URL}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

// --- Salary Drafts ---

export interface DraftListParams {
  status?: DraftStatus;
  limit?: number;
  offset?: number;
}

export function getDrafts(params?: DraftListParams) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return request<{
    drafts: DraftSummary[];
    total: number;
    limit: number;
    offset: number;
  }>(`/api/salary-drafts${qs ? `?${qs}` : ""}`);
}

export function getDraft(id: string) {
  return request<DraftDetail>(`/api/salary-drafts/${id}`);
}

export function transitionDraft(id: string, body: { toStatus: DraftStatus; comment?: string }) {
  return request<DraftDetail>(`/api/salary-drafts/${id}/transition`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// --- Employees ---

export interface EmployeeListParams {
  employmentType?: string;
  department?: string;
  isActive?: string;
  limit?: number;
  offset?: number;
}

export function getEmployees(params?: EmployeeListParams) {
  const sp = new URLSearchParams();
  if (params?.employmentType) sp.set("employmentType", params.employmentType);
  if (params?.department) sp.set("department", params.department);
  if (params?.isActive) sp.set("isActive", params.isActive);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return request<{
    employees: EmployeeSummary[];
    total: number;
    limit: number;
    offset: number;
  }>(`/api/employees${qs ? `?${qs}` : ""}`);
}

export function getEmployee(id: string) {
  return request<EmployeeSummary & { currentSalary: Record<string, unknown> | null }>(
    `/api/employees/${id}`,
  );
}

// --- Audit Logs ---

export interface AuditLogListParams {
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

export function getAuditLogs(params?: AuditLogListParams) {
  const sp = new URLSearchParams();
  if (params?.entityType) sp.set("entityType", params.entityType);
  if (params?.entityId) sp.set("entityId", params.entityId);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return request<{
    logs: AuditLogEntry[];
    total: number;
    limit: number;
    offset: number;
  }>(`/api/audit-logs${qs ? `?${qs}` : ""}`);
}

// --- Chat Messages ---

export interface ChatMessageListParams {
  spaceId?: string;
  messageType?: "MESSAGE" | "THREAD_REPLY";
  threadName?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export function getChatMessages(params?: ChatMessageListParams) {
  const sp = new URLSearchParams();
  if (params?.spaceId) sp.set("spaceId", params.spaceId);
  if (params?.messageType) sp.set("messageType", params.messageType);
  if (params?.threadName) sp.set("threadName", params.threadName);
  if (params?.category) sp.set("category", params.category);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return request<{
    data: ChatMessageSummary[];
    pagination: { limit: number; offset: number; hasMore: boolean };
  }>(`/api/chat-messages${qs ? `?${qs}` : ""}`);
}

export function getChatMessage(id: string) {
  return request<ChatMessageDetail>(`/api/chat-messages/${id}`);
}

export function reclassifyIntent(id: string, body: { category: string; comment?: string }) {
  return request<{ success: boolean; chatMessageId: string; category: string }>(
    `/api/chat-messages/${id}/intent`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function updateResponseStatus(
  id: string,
  responseStatus: "unresponded" | "in_progress" | "responded" | "not_required",
) {
  return request<{ success: boolean; chatMessageId: string; responseStatus: string }>(
    `/api/chat-messages/${id}/response-status`,
    { method: "PATCH", body: JSON.stringify({ responseStatus }) },
  );
}

// --- Stats ---

export function getStatsSummary() {
  return request<StatsSummary>("/api/stats/summary");
}

export function getStatsCategories() {
  return request<{ categories: CategoryStat[]; total: number }>("/api/stats/categories");
}

export interface TimelineParams {
  granularity?: "day" | "week" | "month";
  from?: string;
  to?: string;
}

export function getStatsTimeline(params?: TimelineParams) {
  const sp = new URLSearchParams();
  if (params?.granularity) sp.set("granularity", params.granularity);
  if (params?.from) sp.set("from", params.from);
  if (params?.to) sp.set("to", params.to);
  const qs = sp.toString();
  return request<{ timeline: TimelinePoint[]; granularity: string; from: string; to: string }>(
    `/api/stats/timeline${qs ? `?${qs}` : ""}`,
  );
}

export function getStatsSpaces() {
  return request<{ spaces: SpaceStat[]; total: number }>("/api/stats/spaces");
}

// --- Admin Users ---

export function getAdminUsers() {
  return request<{ data: AdminUser[] }>("/api/admin/users");
}

export function createAdminUser(body: { email: string; displayName: string; role: string }) {
  return request<{ success: boolean; id: string }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAdminUser(
  id: string,
  body: { displayName?: string; role?: string; isActive?: boolean },
) {
  return request<{ success: boolean }>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteAdminUser(id: string) {
  return request<{ success: boolean }>(`/api/admin/users/${id}`, {
    method: "DELETE",
  });
}

// --- Classification Rules ---

export function getClassificationRules() {
  return request<{ rules: ClassificationRule[] }>("/api/classification-rules");
}

export function updateClassificationRule(
  category: string,
  body: {
    keywords?: string[];
    excludeKeywords?: string[];
    patterns?: string[];
    priority?: number;
    description?: string;
    isActive?: boolean;
    sampleMessages?: string[];
  },
) {
  return request<{ success: boolean }>(`/api/classification-rules/${category}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function testClassification(message: string) {
  return request<TestClassificationResult>("/api/classification-rules/test", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// --- LLM Rules ---

export function getLlmRules() {
  return request<{ rules: LlmClassificationRule[] }>("/api/llm-rules");
}

export function createLlmRule(
  body: Omit<LlmClassificationRule, "id" | "createdBy" | "createdAt" | "updatedAt">,
) {
  return request<{ success: boolean; id: string }>("/api/llm-rules", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateLlmRule(id: string, body: Partial<LlmClassificationRule>) {
  return request<{ success: boolean }>(`/api/llm-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteLlmRule(id: string) {
  return request<{ success: boolean }>(`/api/llm-rules/${id}`, {
    method: "DELETE",
  });
}

// --- Chat Sync ---

export function triggerChatSync() {
  return request<{ message: string }>("/api/chat-messages/sync", {
    method: "POST",
  });
}

export function getChatSyncStatus() {
  return request<SyncStatus>("/api/chat-messages/sync/status");
}

// --- Intent Stats ---

export function getIntentStatsSummary() {
  return request<IntentStatsSummary>("/api/intent-stats/summary");
}

export interface ConfusionMatrixParams {
  from?: string;
  to?: string;
}

export function getConfusionMatrix(params?: ConfusionMatrixParams) {
  const sp = new URLSearchParams();
  if (params?.from) sp.set("from", params.from);
  if (params?.to) sp.set("to", params.to);
  const qs = sp.toString();
  return request<{
    entries: ConfusionMatrixEntry[];
    categories: string[];
    period: { from: string; to: string };
  }>(`/api/intent-stats/confusion-matrix${qs ? `?${qs}` : ""}`);
}

export interface ConfidenceTimelineParams {
  granularity?: "day" | "week" | "month";
  method?: "all" | "ai" | "regex" | "manual";
  from?: string;
  to?: string;
}

export function getConfidenceTimeline(params?: ConfidenceTimelineParams) {
  const sp = new URLSearchParams();
  if (params?.granularity) sp.set("granularity", params.granularity);
  if (params?.method) sp.set("method", params.method);
  if (params?.from) sp.set("from", params.from);
  if (params?.to) sp.set("to", params.to);
  const qs = sp.toString();
  return request<{ timeline: ConfidenceTimelinePoint[]; granularity: string; method: string }>(
    `/api/intent-stats/confidence-timeline${qs ? `?${qs}` : ""}`,
  );
}

export interface OverrideRateParams {
  granularity?: "day" | "week" | "month";
  from?: string;
  to?: string;
}

export function getOverrideRateTimeline(params?: OverrideRateParams) {
  const sp = new URLSearchParams();
  if (params?.granularity) sp.set("granularity", params.granularity);
  if (params?.from) sp.set("from", params.from);
  if (params?.to) sp.set("to", params.to);
  const qs = sp.toString();
  return request<{ timeline: OverrideRatePoint[]; granularity: string }>(
    `/api/intent-stats/override-rate${qs ? `?${qs}` : ""}`,
  );
}

export function getOverridePatterns() {
  return request<{ patterns: OverridePattern[]; totalOverrides: number }>(
    "/api/intent-stats/override-patterns",
  );
}
