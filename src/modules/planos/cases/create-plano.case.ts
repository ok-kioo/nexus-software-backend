import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanoRepository } from "../domain/plano.repository";
import type { PlanoCreateDTO } from "../dto/plano.dto";
export const createPlanoCase = (
  repo: PlanoRepository,
  client: SupabaseClient,
  dto: PlanoCreateDTO,
  criadoPor: string,
) => repo.create(client, dto, criadoPor);