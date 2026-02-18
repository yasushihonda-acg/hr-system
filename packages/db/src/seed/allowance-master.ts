import type { AllowanceType } from "@hr-system/shared";
import type { Timestamp } from "firebase-admin/firestore";
import type { AllowanceMaster } from "../types.js";

type AllowanceMasterSeed = Omit<AllowanceMaster, "createdAt"> & {
  createdAt?: Timestamp;
};

export const ALLOWANCE_MASTER_DATA: AllowanceMasterSeed[] = [
  // 役職手当
  {
    allowanceType: "position" as AllowanceType,
    code: "MGR_DEPT",
    name: "部長手当",
    amount: 50000,
    isActive: true,
  },
  {
    allowanceType: "position" as AllowanceType,
    code: "MGR_SECT",
    name: "課長手当",
    amount: 30000,
    isActive: true,
  },
  {
    allowanceType: "position" as AllowanceType,
    code: "LEAD",
    name: "主任手当",
    amount: 15000,
    isActive: true,
  },
  {
    allowanceType: "position" as AllowanceType,
    code: "STAFF",
    name: "一般",
    amount: 0,
    isActive: true,
  },
  // 地域手当
  {
    allowanceType: "region" as AllowanceType,
    code: "URBAN",
    name: "都市部手当",
    amount: 20000,
    isActive: true,
  },
  {
    allowanceType: "region" as AllowanceType,
    code: "SUBURB",
    name: "郊外手当",
    amount: 10000,
    isActive: true,
  },
  {
    allowanceType: "region" as AllowanceType,
    code: "RURAL",
    name: "地方",
    amount: 0,
    isActive: true,
  },
  // 資格手当
  {
    allowanceType: "qualification" as AllowanceType,
    code: "CARE_WORKER",
    name: "介護福祉士手当",
    amount: 10000,
    isActive: true,
  },
  {
    allowanceType: "qualification" as AllowanceType,
    code: "NURSE",
    name: "看護師手当",
    amount: 15000,
    isActive: true,
  },
  {
    allowanceType: "qualification" as AllowanceType,
    code: "HELPER",
    name: "ヘルパー手当",
    amount: 5000,
    isActive: true,
  },
  {
    allowanceType: "qualification" as AllowanceType,
    code: "NONE",
    name: "資格なし",
    amount: 0,
    isActive: true,
  },
];
