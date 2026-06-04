import type { UserRole } from "../../../infra/shared/roles";
import type { UserProfile } from "./user.entity";

export interface UserDetail extends UserProfile {
  turma_ids: string[];
}

export interface UserRepository {
  listWithRoles(): Promise<UserProfile[]>;
  replaceRole(userId: string, role: UserRole): Promise<void>;
  /**
   * Returns the primary role of the user (or null if no profile exists).
   */
  getCurrentRole(userId: string): Promise<UserRole | null>;
  getById(userId: string): Promise<UserDetail | null>;
  updateProfile(userId: string, patch: { name?: string; email?: string }): Promise<void>;
  updateAuthEmail(userId: string, email: string): Promise<void>;
  replaceTurmas(userId: string, turmaIds: string[]): Promise<void>;
  getOnboarding(userId: string): Promise<unknown>;
  updateOnboarding(userId: string, state: unknown): Promise<void>;
}

export { userRepository } from "../../../infra/database/repositories/user.repository";
