import type { CapeloMessage } from "../dto/capelo.dto";
export interface CapeloRepository {
  list(userId: string, params: { limit: number; before?: string }): Promise<CapeloMessage[]>;
  insert(userId: string, role: CapeloMessage["role"], content: string): Promise<CapeloMessage>;
  clear(userId: string): Promise<void>;
}
export { capeloRepository } from "../../../infra/database/repositories/capelo.repository";