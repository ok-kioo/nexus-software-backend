import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContatoRepository } from "../domain/contato.repository";
import type { UserRole } from "../../../infra/shared/roles";
import type { ContatoCreateDTO } from "../dto/contato.dto";

export const listContatosCase = (repo: ContatoRepository, client: SupabaseClient, alunoId?: string) =>
  repo.list(client, alunoId);
export const createContatoCase = (
  repo: ContatoRepository,
  client: SupabaseClient,
  dto: ContatoCreateDTO,
  autorId: string,
) => repo.create(client, dto, autorId);
export const deleteContatoCase = (
  repo: ContatoRepository,
  client: SupabaseClient,
  id: string,
  role: UserRole,
  userId: string,
) => repo.delete(client, id, role, userId);