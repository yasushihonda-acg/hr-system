import type { EmploymentType } from "@hr-system/shared";
import type { Timestamp } from "firebase-admin/firestore";
import type { Employee } from "../types.js";

type EmployeeSeed = Omit<Employee, "hireDate" | "createdAt" | "updatedAt"> & {
  hireDate?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export const TEST_EMPLOYEES: EmployeeSeed[] = [
  {
    employeeNumber: "EMP001",
    name: "田中太郎",
    email: "tanaka@example.com",
    googleChatUserId: null,
    employmentType: "full_time" as EmploymentType,
    department: "人事部",
    position: "課長",
    isActive: true,
  },
  {
    employeeNumber: "EMP002",
    name: "鈴木花子",
    email: "suzuki@example.com",
    googleChatUserId: null,
    employmentType: "full_time" as EmploymentType,
    department: "営業部",
    position: "主任",
    isActive: true,
  },
  {
    employeeNumber: "EMP003",
    name: "佐藤一郎",
    email: "sato@example.com",
    googleChatUserId: null,
    employmentType: "full_time" as EmploymentType,
    department: "介護部",
    position: "介護福祉士",
    isActive: true,
  },
  {
    employeeNumber: "EMP004",
    name: "山田美咲",
    email: "yamada@example.com",
    googleChatUserId: null,
    employmentType: "part_time" as EmploymentType,
    department: "介護部",
    position: null,
    isActive: true,
  },
  {
    employeeNumber: "EMP005",
    name: "高橋健太",
    email: "takahashi@example.com",
    googleChatUserId: null,
    employmentType: "part_time" as EmploymentType,
    department: "調理部",
    position: null,
    isActive: true,
  },
  {
    employeeNumber: "EMP006",
    name: "伊藤さくら",
    email: "ito@example.com",
    googleChatUserId: null,
    employmentType: "visiting_nurse" as EmploymentType,
    department: "訪問看護部",
    position: null,
    isActive: true,
  },
  {
    employeeNumber: "EMP007",
    name: "渡辺浩二",
    email: "watanabe@example.com",
    googleChatUserId: null,
    employmentType: "visiting_nurse" as EmploymentType,
    department: "訪問看護部",
    position: null,
    isActive: true,
  },
];
