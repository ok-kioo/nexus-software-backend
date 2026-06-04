import type { SupabaseClient } from "@supabase/supabase-js";
import type { TurmaRepository } from "../domain/turma.repository";

export async function listTurmasWithRelationsCase(repo: TurmaRepository, client: SupabaseClient) {
  return repo.listWithRelations(client);
}