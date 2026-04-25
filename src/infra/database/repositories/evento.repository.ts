import { createAdminClient } from "../supabase-client";
import { dbError } from "../../shared/db-errors";
import type { EventoRepository } from "../../../modules/eventos/domain/evento.repository";
import type { EventoCreateDTO, EventoUpdateDTO } from "../../../modules/eventos/dto/evento.dto";

export class SupabaseEventoRepository implements EventoRepository {
  async list() {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("eventos_calendario")
      .select("*, unidade:unidades(nome_unidade)")
      .order("data_inicio", { ascending: true });
    if (error) throw dbError(error);
    return data ?? [];
  }
  async create(dto: EventoCreateDTO, criadoPor: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("eventos_calendario")
      .insert({ ...dto, criado_por: criadoPor })
      .select()
      .maybeSingle();
    if (error) throw dbError(error, 400);
    return data;
  }
  async update(id: string, dto: EventoUpdateDTO) {
    const admin = createAdminClient();
    const { data, error } = await admin.from("eventos_calendario").update(dto).eq("id", id).select().maybeSingle();
    if (error) throw dbError(error, 400);
    return data;
  }
  async delete(id: string) {
    const admin = createAdminClient();
    const { error } = await admin.from("eventos_calendario").delete().eq("id", id);
    if (error) throw dbError(error, 400);
  }
}

export const eventoRepository: EventoRepository = new SupabaseEventoRepository();
