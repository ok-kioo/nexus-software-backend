import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotasByTurmaResult } from "./nota.entity";

export interface NotaRepository {
  listByTurma(client: SupabaseClient, turmaId: string): Promise<NotasByTurmaResult>;
}

export { notaRepository } from "../../../infra/database/repositories/nota.repository";