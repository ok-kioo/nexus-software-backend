import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../../shared/db-errors";
import type { MatriculaRepository, PagedRelations } from "../../../modules/matriculas/domain/matricula.repository";
import type { MatriculaListFilters } from "../../../modules/matriculas/domain/matricula.entity";

export class SupabaseMatriculaRepository implements MatriculaRepository {
  async listWithRelations(client: SupabaseClient, filters: MatriculaListFilters): Promise<PagedRelations> {
    const { page, pageSize, search, status, dataInicio, dataFim, unidadeId, cursoId, turmaId } = filters;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let turmaIdsFilter: string[] | null = null;
    if (turmaId && turmaId !== "all") {
      turmaIdsFilter = [turmaId];
    } else if ((unidadeId && unidadeId !== "all") || (cursoId && cursoId !== "all")) {
      let tq = client.from("turmas").select("id");
      if (unidadeId && unidadeId !== "all") tq = tq.eq("unidade_id", unidadeId);
      if (cursoId && cursoId !== "all") tq = tq.eq("curso_id", cursoId);
      const { data: turmaRows, error: turmaErr } = await tq;
      if (turmaErr) throw dbError(turmaErr);
      turmaIdsFilter = (turmaRows ?? []).map((t: { id: string }) => t.id);
      if (turmaIdsFilter.length === 0) {
        return { rows: [], total: 0, page, pageSize };
      }
    }

    let q = client
      .from("matriculas")
      .select(
        `id, numero_matricula, status, data_inicio, data_fim, created_at,
         aluno:alunos!inner(id, nome_aluno, documento),
         turma:turmas(id, nome_turma, capacidade,
           curso:cursos(id, nome_curso),
           unidade:unidades(id, nome_unidade, estado, cidade))`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (search) {
      const s = search.replace(/[,()]/g, "");
      q = q.or(
        `numero_matricula.ilike.%${s}%,aluno.nome_aluno.ilike.%${s}%,aluno.documento.ilike.%${s}%`,
      );
    }
    if (status && status !== "all") q = q.eq("status", status);
    if (dataInicio) q = q.gte("data_inicio", dataInicio);
    if (dataFim) q = q.lte("data_inicio", dataFim);
    if (turmaIdsFilter) q = q.in("turma_id", turmaIdsFilter);

    const { data, error, count } = await q.range(from, to);
    if (error) throw dbError(error);
    return { rows: data ?? [], total: count ?? 0, page, pageSize };
  }
}

export const matriculaRepository: MatriculaRepository = new SupabaseMatriculaRepository();
