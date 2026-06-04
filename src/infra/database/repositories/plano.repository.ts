import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../../shared/db-errors";
import type { PlanoRepository } from "../../../modules/planos/domain/plano.repository";
import type { PlanoCreateDTO, PlanoUpdateDTO } from "../../../modules/planos/dto/plano.dto";

export class SupabasePlanoRepository implements PlanoRepository {
  async list(client: SupabaseClient): Promise<unknown[]> {
    const { data, error } = await client
      .from("planos_acao")
      .select("*, aluno:alunos(id, nome_aluno)")
      .order("created_at", { ascending: false });
    if (error) throw dbError(error);
    return data ?? [];
  }
  async create(client: SupabaseClient, dto: PlanoCreateDTO, criadoPor: string) {
    const { data, error } = await client
      .from("planos_acao")
      .insert({ ...dto, criado_por: criadoPor })
      .select()
      .maybeSingle();
    if (error) throw dbError(error, 400);
    return data;
  }
  async update(client: SupabaseClient, id: string, dto: PlanoUpdateDTO & { concluido_em?: string }) {
    const { data, error } = await client.from("planos_acao").update(dto).eq("id", id).select().maybeSingle();
    if (error) throw dbError(error, 400);
    return data;
  }
  async delete(client: SupabaseClient, id: string) {
    const { error } = await client.from("planos_acao").delete().eq("id", id);
    if (error) throw dbError(error, 400);
  }
}

export const planoRepository: PlanoRepository = new SupabasePlanoRepository();
