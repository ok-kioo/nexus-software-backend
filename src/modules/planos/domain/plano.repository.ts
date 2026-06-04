import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanoCreateDTO, PlanoUpdateDTO } from "../dto/plano.dto";

export interface PlanoRepository {
  list(client: SupabaseClient): Promise<unknown[]>;
  create(client: SupabaseClient, dto: PlanoCreateDTO, criadoPor: string): Promise<unknown>;
  update(client: SupabaseClient, id: string, dto: PlanoUpdateDTO & { concluido_em?: string }): Promise<unknown | null>;
  delete(client: SupabaseClient, id: string): Promise<void>;
}

export { planoRepository } from "../../../infra/database/repositories/plano.repository";