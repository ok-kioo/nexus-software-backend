import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../../shared/db-errors";
import type { NotaRepository } from "../../../modules/notas/domain/nota.repository";
import type { NotasByTurmaResult } from "../../../modules/notas/domain/nota.entity";

export class SupabaseNotaRepository implements NotaRepository {
  async listByTurma(client: SupabaseClient, turmaId: string): Promise<NotasByTurmaResult> {
    const { data: mats, error: mErr } = await client
      .from("matriculas")
      .select("id, status, aluno:alunos(id, nome_aluno)")
      .eq("turma_id", turmaId)
      .eq("status", "ativa")
      .order("created_at");
    if (mErr) throw dbError(mErr);
    const matIds = (mats ?? []).map((m: { id: string }) => m.id);
    let registros: unknown[] = [];
    if (matIds.length) {
      const { data, error } = await client.from("notas").select("*").in("matricula_id", matIds);
      if (error) throw dbError(error);
      registros = data ?? [];
    }
    return { matriculas: mats ?? [], registros };
  }
}

export const notaRepository: NotaRepository = new SupabaseNotaRepository();
