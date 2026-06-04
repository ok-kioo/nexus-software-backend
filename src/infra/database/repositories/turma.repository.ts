import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../../shared/db-errors";
import type { TurmaRepository } from "../../../modules/turmas/domain/turma.repository";
import type { TurmaWithRelations } from "../../../modules/turmas/domain/turma.entity";

export class SupabaseTurmaRepository implements TurmaRepository {
  async listWithRelations(client: SupabaseClient): Promise<TurmaWithRelations[]> {
    const { data, error } = await client
      .from("turmas")
      .select(
        "*, curso:cursos(id, nome_curso), unidade:unidades(id, nome_unidade, estado), matriculas(id, status)",
      )
      .order("nome_turma", { ascending: true });
    if (error) throw dbError(error);
    return (data ?? []) as unknown as TurmaWithRelations[];
  }
}

export const turmaRepository: TurmaRepository = new SupabaseTurmaRepository();
