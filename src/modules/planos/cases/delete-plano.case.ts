import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanoRepository } from "../domain/plano.repository";
export const deletePlanoCase = (repo: PlanoRepository, client: SupabaseClient, id: string) =>
  repo.delete(client, id);