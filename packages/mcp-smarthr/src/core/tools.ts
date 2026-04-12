import { z } from "zod";
import type { SmartHRClient } from "./smarthr-client.js";

/** ページネーション共通パラメータ shape */
const paginationShape = {
  page: z.number().int().min(1).optional().describe("ページ番号（1始まり）"),
  per_page: z.number().int().min(1).max(100).optional().describe("1ページあたりの件数（最大100）"),
};

/** ツール名一覧（TOOL_PERMISSIONS との同期を型で強制するために定義） */
const TOOL_NAMES = [
  "list_employees",
  "get_employee",
  "search_employees",
  "get_pay_statements",
  "list_departments",
  "list_positions",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

interface ToolDefinition {
  description: string;
  shape: Record<string, unknown>;
  handler: (params: never) => Promise<unknown>;
}

/** ツール定義一覧 */
export function defineTools(client: SmartHRClient): Record<ToolName, ToolDefinition> {
  return {
    list_employees: {
      description: "SmartHRの従業員一覧を取得します。ページネーション対応。",
      shape: paginationShape,
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
      handler: async (params: { query: string; page?: number; per_page?: number }) => {
        const result = await client.searchEmployees(params.query, {
          page: params.page,
          per_page: params.per_page,
        });
        return formatListResult("従業員", result.data, result.totalCount);
      },
    },

    get_pay_statements: {
      description: "SmartHRの給与明細を取得します。従業員ID・年・月で絞り込み可能。",
      shape: {
        crew_id: z.string().optional().describe("従業員ID（絞り込み）"),
        year: z.number().int().optional().describe("年（例: 2026）"),
        month: z.number().int().min(1).max(12).optional().describe("月（1-12）"),
        ...paginationShape,
      },
      handler: async (params: {
        crew_id?: string;
        year?: number;
        month?: number;
        page?: number;
        per_page?: number;
      }) => {
        const result = await client.getPayStatements(params);
        return formatListResult("給与明細", result.data, result.totalCount);
      },
    },

    list_departments: {
      description: "SmartHRの部署一覧を取得します。",
      shape: paginationShape,
      handler: async (params: { page?: number; per_page?: number }) => {
        const result = await client.listDepartments(params);
        return formatListResult("部署", result.data, result.totalCount);
      },
    },

    list_positions: {
      description: "SmartHRの役職一覧を取得します。",
      shape: paginationShape,
      handler: async (params: { page?: number; per_page?: number }) => {
        const result = await client.listPositions(params);
        return formatListResult("役職", result.data, result.totalCount);
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
