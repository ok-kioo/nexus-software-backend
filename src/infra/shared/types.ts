import type { UserRole } from "./roles";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
  role: UserRole;
}

export interface AuthContextValue {
  token: string;
  user: AppUser;
}

export interface InviteRow {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
  turma_ids: string[];
  invited_by?: string;
  accepted_at?: string | null;
  accepted_by?: string | null;
}