import { z } from "zod";
import type { SmartHRClient } from "./smarthr-client.js";

/** ページネーション共通パラメータ shape */
const paginationShape = {
  page: z.number().int().min(1).optional().describe("ページ番号（1始まり）"),
  per_page: z.number().int().min(1).max(100).optional().describe("1ページあたりの件数（最大100）"),
};

/** 更新可能フィールド（セキュリティ上、ハードコードで制限） */
const UPDATABLE_FIELDS = [
  "last_name",
  "first_name",
  "last_name_yomi",
  "first_name_yomi",
  "emp_code",
  "entered_at",
  "resigned_at",
  "department",
  "position",
  "employment_type",
] as const;

/** update_employee 用の Zod shape（id 以外の全フィールドを optional で定義） */
const updatableFieldsShape: Record<string, z.ZodTypeAny> = {
  last_name: z.string().optional().describe("姓"),
  first_name: z.string().optional().describe("名"),
  last_name_yomi: z.string().optional().describe("姓（よみがな）"),
  first_name_yomi: z.string().optional().describe("名（よみがな）"),
  emp_code: z.string().optional().describe("社員番号"),
  entered_at: z.string().optional().describe("入社日（YYYY-MM-DD）"),
  resigned_at: z.string().optional().describe("退職日（YYYY-MM-DD）"),
  department: z.string().optional().describe("部署ID"),
  position: z.string().optional().describe("役職ID"),
  employment_type: z.string().optional().describe("雇用形態ID"),
};

/** undefined・null・空文字列・空白のみ文字列を除去する（SmartHR の空上書き防止） */
function stripEmptyValues(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "string" && value.trim() === "") continue;
    result[key] = value;
  }
  return result;
}

/** ランタイムでフィールド許可リストを強制する（defense-in-depth） */
function filterAllowedFields(
  obj: Record<string, unknown>,
  allowedFields: readonly string[],
): Record<string, unknown> {
  const allowed = new Set<string>(allowedFields);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (allowed.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

/** ツール名一覧（TOOL_PERMISSIONS との同期を型で強制するために定義） */
const TOOL_NAMES = [
  "list_employees",
  "get_employee",
  "search_employees",
  "list_departments",
  "list_positions",
  "update_employee",
  "create_employee",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/** MCP ツールアノテーション（readOnlyHint, destructiveHint 等） */
export interface ToolAnnotation {
  /** true = 読み取り専用（副作用なし） */
  readOnlyHint?: boolean;
  /** true = 破壊的操作（データ削除等） */
  destructiveHint?: boolean;
  /** true = 同じパラメータで複数回呼んでも結果が変わらない */
  idempotentHint?: boolean;
  /** ツール表示名（人間向け） */
  title?: string;
}

interface ToolDefinition {
  description: string;
  shape: Record<string, z.ZodTypeAny>;
  annotations: ToolAnnotation;
  handler: (params: never) => Promise<unknown>;
}

/** ツール定義一覧 */
export function defineTools(client: SmartHRClient): Record<ToolName, ToolDefinition> {
  return {
    list_employees: {
      description: "SmartHRの従業員一覧を取得します。ページネーション対応。",
      shape: paginationShape,
      annotations: { readOnlyHint: true, idempotentHint: true, title: "従業員一覧" },
      handler: async (params: { page?: number; per_page?: number }) => {
        const result = await client.listEmployees(params);
        return formatListResult("従業員", result.data, result.totalCount);
      },
    },

    get_employee: {
      description: "SmartHRの従業員詳細を従業員IDで取得します。",
      shape: {
        id: z.string().describe("SmartHR従業員ID"),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, title: "従業員詳細" },
      handler: async (params: { id: string }) => {
        return await client.getEmployee(params.id);
      },
    },

    search_employees: {
      description: "SmartHRの従業員を名前・社員番号等で検索します。",
      shape: {
        query: z.string().describe("検索キーワード（名前、社員番号等）"),
        ...paginationShape,
      },
      annotations: { readOnlyHint: true, idempotentHint: true, title: "従業員検索" },
      handler: async (params: { query: string; page?: number; per_page?: number }) => {
        const result = await client.searchEmployees(params.query, {
          page: params.page,
          per_page: params.per_page,
        });
        return formatListResult("従業員", result.data, result.totalCount);
      },
    },

    list_departments: {
      description: "SmartHRの部署一覧を取得します。",
      shape: paginationShape,
      annotations: { readOnlyHint: true, idempotentHint: true, title: "部署一覧" },
      handler: async (params: { page?: number; per_page?: number }) => {
        const result = await client.listDepartments(params);
        return formatListResult("部署", result.data, result.totalCount);
      },
    },

    list_positions: {
      description: "SmartHRの役職一覧を取得します。",
      shape: paginationShape,
      annotations: { readOnlyHint: true, idempotentHint: true, title: "役職一覧" },
      handler: async (params: { page?: number; per_page?: number }) => {
        const result = await client.listPositions(params);
        return formatListResult("役職", result.data, result.totalCount);
      },
    },

    update_employee: {
      description:
        "SmartHRの従業員情報を部分更新します（PATCH）。write権限が必要です。更新前に必ずユーザーに変更内容を確認してください。空値を送信するとSmartHR側のデータが消えるため、変更するフィールドのみ指定してください。",
      shape: {
        id: z.string().describe("SmartHR従業員ID"),
        ...updatableFieldsShape,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        title: "従業員更新",
      },
      handler: async (
        params: { id: string } & Partial<Record<(typeof UPDATABLE_FIELDS)[number], string>>,
      ) => {
        const { id, ...rest } = params;
        const allowed = filterAllowedFields(rest, UPDATABLE_FIELDS);
        const fields = stripEmptyValues(allowed);
        if (Object.keys(fields).length === 0) {
          throw new Error("更新するフィールドを1つ以上指定してください");
        }
        return await client.updateEmployee(id, fields);
      },
    },

    create_employee: {
      description:
        "SmartHRに新しい従業員を登録します。write権限が必要です。登録前に必ずユーザーに入力内容を確認してください。",
      shape: {
        last_name: z.string().min(1, "姓は必須です").describe("姓"),
        first_name: z.string().min(1, "名は必須です").describe("名"),
        last_name_yomi: z.string().optional().describe("姓（よみがな）"),
        first_name_yomi: z.string().optional().describe("名（よみがな）"),
        emp_code: z.string().optional().describe("社員番号"),
        entered_at: z.string().optional().describe("入社日（YYYY-MM-DD）"),
        department: z.string().optional().describe("部署ID"),
        position: z.string().optional().describe("役職ID"),
        employment_type: z.string().optional().describe("雇用形態ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        title: "従業員登録",
      },
      handler: async (params: {
        last_name: string;
        first_name: string;
        last_name_yomi?: string;
        first_name_yomi?: string;
        emp_code?: string;
        entered_at?: string;
        department?: string;
        position?: string;
        employment_type?: string;
      }) => {
        const fields = stripEmptyValues(params);
        return await client.createEmployee(fields);
      },
    },
  };
}

function formatListResult(
  label: string,
  data: unknown[],
  totalCount: number,
): { summary: string; data: unknown[] } {
  return {
    summary: `${label}: ${data.length}件 / 全${totalCount}件`,
    data,
  };
}
