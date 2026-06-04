import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../../shared/db-errors";
import type { FrequenciaRepository } from "../../../modules/frequencia/domain/frequencia.repository";
import type { FrequenciaByTurmaResult } from "../../../modules/frequencia/domain/frequencia.entity";

export class SupabaseFrequenciaRepository implements FrequenciaRepository {
  async listByTurma(client: SupabaseClient, turmaId: string, fromDate?: string, toDate?: string): Promise<FrequenciaByTurmaResult> {
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
      let q = client.from("frequencia").select("*").in("matricula_id", matIds);
      if (fromDate) q = q.gte("data", fromDate);
      if (toDate) q = q.lte("data", toDate);
      const { data, error } = await q.order("data", { ascending: false });
      if (error) throw dbError(error);
      registros = data ?? [];
    }
    return { matriculas: mats ?? [], registros };
  }
}

export const frequenciaRepository: FrequenciaRepository = new SupabaseFrequenciaRepository();
