import type { UserRole } from "@hr-system/shared";

export const INITIAL_ALLOWED_USERS: Array<{
  email: string;
  displayName: string;
  role: UserRole;
}> = [
  {
    email: "yasushi.honda@aozora-cg.com",
    displayName: "本田 泰志",
    role: "admin",
  },
];
