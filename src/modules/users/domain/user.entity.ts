import type { UserRole } from "../../../infra/shared/roles";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
}