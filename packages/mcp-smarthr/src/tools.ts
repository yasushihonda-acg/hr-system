import { z } from "zod";
import type { SmartHRClient } from "./smarthr-client.js";

/** ページネーション共通パラメータ shape */
const paginationShape = {
  page: z.number().int().min(1).optional().describe("ページ番号（1始まり）"),
  per_page: z.number().int().min(1).max(100).optional().describe("1ページあたりの件数（最大100）"),
};

/** ツール定義一覧 */
export function defineTools(client: SmartHRClient) {
  return {
    list_employees: {
      description: "SmartHRの従業員一覧を取得します。ページネーション対応。",
      shape: paginationShape,
      handler: async (params: { page?: number; per_page?: number }) => {
        const result = await client.listEmployees(params);
        return formatListResult("従業員", result.data.length, result.totalCount, result.data);
      },
    },

    get_employee: {
      description: "SmartHRの従業員詳細を従業員IDで取得します。",
      shape: {
        id: z.string().describe("SmartHR従業員ID"),
      },
      handler: async (params: { id: string }) => {
        const crew = await client.getEmployee(params.id);
        return formatResult(crew);
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
        return formatListResult("従業員", result.data.length, result.totalCount, result.data);
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
        return formatListResult("給与明細", result.data.length, result.totalCount, result.data);
      },
    },

    list_departments: {
      description: "SmartHRの部署一覧を取得します。",
      shape: paginationShape,
      handler: async (params: { page?: number; per_page?: number }) => {
        const result = await client.listDepartments(params);
        return formatListResult("部署", result.data.length, result.totalCount, result.data);
      },
    },

    list_positions: {
      description: "SmartHRの役職一覧を取得します。",
      shape: paginationShape,
      handler: async (params: { page?: number; per_page?: number }) => {
        const result = await client.listPositions(params);
        return formatListResult("役職", result.data.length, result.totalCount, result.data);
      },
    },
  } as const;
}

function formatResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function formatListResult(
  label: string,
  count: number,
  totalCount: number,
  data: unknown[],
): string {
  return JSON.stringify(
    {
      summary: `${label}: ${count}件 / 全${totalCount}件`,
      data,
    },
    null,
    2,
  );
}
