import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanoRepository } from "../domain/plano.repository";
export const listPlanosCase = (repo: PlanoRepository, client: SupabaseClient) => repo.list(client);