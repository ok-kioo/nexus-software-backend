import type { SupabaseClient } from "@supabase/supabase-js";
import type { FrequenciaRepository } from "../domain/frequencia.repository";

export async function listFrequenciaByTurmaCase(
  repo: FrequenciaRepository,
  client: SupabaseClient,
  turmaId: string,
  from?: string,
  to?: string,
) {
  return repo.listByTurma(client, turmaId, from, to);
}