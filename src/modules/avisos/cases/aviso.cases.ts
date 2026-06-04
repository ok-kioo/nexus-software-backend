import type { AvisoRepository } from "../domain/aviso.repository";
import type { UserRole } from "../../../infra/shared/roles";
import type { AvisoCreateDTO, AvisoUpdateDTO } from "../dto/aviso.dto";

export const listAvisosCase = (repo: AvisoRepository) => repo.list();
export const createAvisoCase = (repo: AvisoRepository, dto: AvisoCreateDTO, autorId: string) =>
  repo.create(dto, autorId);
export const updateAvisoCase = (repo: AvisoRepository, id: string, dto: AvisoUpdateDTO, role: UserRole, userId: string) =>
  repo.update(id, dto, role, userId);
export const deleteAvisoCase = (repo: AvisoRepository, id: string, role: UserRole, userId: string) =>
  repo.delete(id, role, userId);
export const listLeiturasCase = (repo: AvisoRepository, userId: string) => repo.listLeituras(userId);
export const markReadCase = (repo: AvisoRepository, avisoId: string, userId: string) =>
  repo.markRead(avisoId, userId);