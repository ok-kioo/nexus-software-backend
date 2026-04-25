import type { SupabaseClient } from "@supabase/supabase-js";
import type { TurmaWithRelations } from "./turma.entity";

export interface TurmaRepository {
  listWithRelations(client: SupabaseClient): Promise<TurmaWithRelations[]>;
}

export { turmaRepository } from "../../../infra/database/repositories/turma.repository";