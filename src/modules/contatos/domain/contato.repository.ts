import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "../../../infra/shared/roles";
import type { ContatoCreateDTO } from "../dto/contato.dto";

export interface ContatoRepository {
  list(client: SupabaseClient, alunoId?: string): Promise<unknown[]>;
  create(client: SupabaseClient, dto: ContatoCreateDTO, autorId: string): Promise<unknown>;
  delete(client: SupabaseClient, id: string, role: UserRole, userId: string): Promise<void>;
}

export { contatoRepository } from "../../../infra/database/repositories/contato.repository";