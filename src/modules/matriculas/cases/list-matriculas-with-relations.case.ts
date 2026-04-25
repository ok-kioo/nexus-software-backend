import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatriculaListFilters } from "../domain/matricula.entity";
import type { MatriculaRepository } from "../domain/matricula.repository";

export async function listMatriculasWithRelationsCase(
  repo: MatriculaRepository,
  client: SupabaseClient,
  filters: MatriculaListFilters,
) {
  return repo.listWithRelations(client, filters);
}