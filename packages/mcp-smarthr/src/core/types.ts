/**
 * SmartHR API レスポンス型定義
 * @see https://developer.smarthr.jp/api
 */

/** 従業員（crew） */
export interface SmartHRCrew {
  id: string;
  emp_code: string | null;
  last_name: string;
  first_name: string;
  last_name_yomi: string | null;
  first_name_yomi: string | null;
  email: string | null;
  gender: string | null;
  birth_at: string | null;
  entered_at: string | null;
  resigned_at: string | null;
  department: SmartHRDepartmentRef | null;
  position: string | null;
  employment_type: SmartHREmploymentType | null;
  custom_fields: SmartHRCustomField[];
  created_at: string;
  updated_at: string;
}

/** 部署参照（crew内の埋め込み） */
export interface SmartHRDepartmentRef {
  id: string;
  name: string;
  code: string | null;
}

/** 部署 */
export interface SmartHRDepartment {
  id: string;
  name: string;
  code: string | null;
  parent: SmartHRDepartmentRef | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/** 役職 */
export interface SmartHRPosition {
  id: string;
  name: string;
  code: string | null;
  rank: number | null;
  created_at: string;
  updated_at: string;
}

/** 雇用形態 */
export interface SmartHREmploymentType {
  id: string;
  name: string;
  preset_type: string | null;
}

/** カスタムフィールド */
export interface SmartHRCustomField {
  template: { id: string; name: string };
  value: string | null;
}

/** ページネーション付きリストレスポンス */
export interface SmartHRListResponse<T> {
  data: T[];
  total_count: number;
  page: number;
  per_page: number;
}

/** SmartHR APIクライアント設定 */
export interface SmartHRConfig {
  accessToken: string;
  tenantId: string;
  baseUrl?: string;
  cacheTtlMs?: number;
}
