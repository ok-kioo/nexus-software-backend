import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertaRepository } from "../domain/alerta.repository";
import type { AlertaStatus } from "../domain/alerta.entity";

export async function updateAlertaStatusCase(
  repo: AlertaRepository,
  client: SupabaseClient,
  id: string,
  status: Extract<AlertaStatus, "resolvido" | "ignorado" | "ativo">,
  actorId: string,
) {
  return repo.updateStatus(client, id, status, actorId);
}