import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanoRepository } from "../domain/plano.repository";
import type { PlanoUpdateDTO } from "../dto/plano.dto";

export async function updatePlanoCase(
  repo: PlanoRepository,
  client: SupabaseClient,
  id: string,
  dto: PlanoUpdateDTO,
) {
  const updates: PlanoUpdateDTO & { concluido_em?: string } = { ...dto };
  if (dto.status === "concluido") {
    updates.concluido_em = new Date().toISOString();
  }
  return repo.update(client, id, updates);
}