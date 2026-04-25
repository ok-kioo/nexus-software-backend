import type { UserRole } from "../../../infra/shared/roles";
import type { UserProfile } from "./user.entity";

export interface UserRepository {
  listWithRoles(): Promise<UserProfile[]>;
  replaceRole(userId: string, role: UserRole): Promise<void>;
  /**
   * Retorna o papel primário atual do usuário (ou null se não houver perfil).
   * Usado para validar hierarquia antes de uma mudança de papel.
   */
  getCurrentRole(userId: string): Promise<UserRole | null>;
}

export { userRepository } from "../../../infra/database/repositories/user.repository";