import type { DraftStatus } from "@hr-system/shared";
import { auth } from "@/auth";
import type {
  AuditLogEntry,
  ChatMessageDetail,
  ChatMessageSummary,
  DraftDetail,
  DraftSummary,
  EmployeeSummary,
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
