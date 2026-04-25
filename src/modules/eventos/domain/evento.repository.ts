import type { EventoCreateDTO, EventoUpdateDTO } from "../dto/evento.dto";

export interface EventoRepository {
  list(): Promise<unknown[]>;
  create(dto: EventoCreateDTO, criadoPor: string): Promise<unknown>;
  update(id: string, dto: EventoUpdateDTO): Promise<unknown | null>;
  delete(id: string): Promise<void>;
}

// A implementação concreta vive em
// `apps/backend/src/infra/database/repositories/evento.repository.ts` para
// manter o domain livre de qualquer dependência de infra (Supabase, pg, etc.).
export { eventoRepository } from "../../../infra/database/repositories/evento.repository";