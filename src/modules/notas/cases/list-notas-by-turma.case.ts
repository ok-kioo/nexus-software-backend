import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotaRepository } from "../domain/nota.repository";

export async function listNotasByTurmaCase(repo: NotaRepository, client: SupabaseClient, turmaId: string) {
  return repo.listByTurma(client, turmaId);
}