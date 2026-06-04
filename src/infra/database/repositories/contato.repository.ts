import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../../shared/db-errors";
import type { UserRole } from "../../shared/roles";
import type { ContatoRepository } from "../../../modules/contatos/domain/contato.repository";
import type { ContatoCreateDTO } from "../../../modules/contatos/dto/contato.dto";

export class SupabaseContatoRepository implements ContatoRepository {
  async list(client: SupabaseClient, alunoId?: string) {
    let q = client.from("contatos_aluno").select("*").order("created_at", { ascending: false });
    if (alunoId) q = q.eq("aluno_id", alunoId);
    const { data, error } = await q;
    if (error) throw dbError(error);
    return data ?? [];
  }
  async create(client: SupabaseClient, dto: ContatoCreateDTO, autorId: string) {
    const { data, error } = await client
      .from("contatos_aluno")
      .insert({ ...dto, autor_id: autorId })
      .select()
      .maybeSingle();
    if (error) throw dbError(error, 400);
    return data;
  }
  async delete(client: SupabaseClient, id: string, role: UserRole, userId: string) {
    let q = client.from("contatos_aluno").delete().eq("id", id);
    if (role !== "administrador") q = q.eq("autor_id", userId);
    const { error } = await q;
    if (error) throw dbError(error, 400);
  }
}

export const contatoRepository: ContatoRepository = new SupabaseContatoRepository();
