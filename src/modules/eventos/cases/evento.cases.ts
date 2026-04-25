import type { EventoRepository } from "../domain/evento.repository";
import type { EventoCreateDTO, EventoUpdateDTO } from "../dto/evento.dto";

export const listEventosCase = (repo: EventoRepository) => repo.list();
export const createEventoCase = (repo: EventoRepository, dto: EventoCreateDTO, criadoPor: string) =>
  repo.create(dto, criadoPor);
export const updateEventoCase = (repo: EventoRepository, id: string, dto: EventoUpdateDTO) => repo.update(id, dto);
export const deleteEventoCase = (repo: EventoRepository, id: string) => repo.delete(id);