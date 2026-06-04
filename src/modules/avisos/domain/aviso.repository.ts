import type { UserRole } from "../../../infra/shared/roles";
import type { AvisoCreateDTO, AvisoUpdateDTO } from "../dto/aviso.dto";

export interface AvisoRepository {
  list(): Promise<unknown[]>;
  create(dto: AvisoCreateDTO, autorId: string): Promise<unknown>;
  update(id: string, dto: AvisoUpdateDTO, role: UserRole, userId: string): Promise<unknown | null>;
  delete(id: string, role: UserRole, userId: string): Promise<void>;
  listLeituras(userId: string): Promise<unknown[]>;
  markRead(avisoId: string, userId: string): Promise<void>;
}

export { avisoRepository } from "../../../infra/database/repositories/aviso.repository";