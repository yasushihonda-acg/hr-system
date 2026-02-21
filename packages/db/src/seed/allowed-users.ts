import type { UserRole } from "@hr-system/shared";

export const INITIAL_ALLOWED_USERS: Array<{
  email: string;
  displayName: string;
  role: UserRole;
}> = [
  {
    email: "admin@example.com",
    displayName: "管理者",
    role: "admin",
  },
];
