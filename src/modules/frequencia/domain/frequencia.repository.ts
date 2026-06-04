import type { SupabaseClient } from "@supabase/supabase-js";
import type { FrequenciaByTurmaResult } from "./frequencia.entity";

export interface FrequenciaRepository {
  listByTurma(client: SupabaseClient, turmaId: string, from?: string, to?: string): Promise<FrequenciaByTurmaResult>;
}

export { frequenciaRepository } from "../../../infra/database/repositories/frequencia.repository";