import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertaRepository } from "../domain/alerta.repository";
import { computeAlertasCase } from "./compute-alertas.case";

/**
 * Recomputa os alertas e persiste/atualiza no banco. Retorna a lista
 * resultante de alertas ativos. Idempotente — se um alerta já existir
 * ativo para o mesmo (tipo, entidade), apenas refresca `last_seen_at`.
 */
export async function snapshotAlertasCase(
  repo: AlertaRepository,
  client: SupabaseClient,
  actorId: string | null,
) {
  const snapshots = await computeAlertasCase(client);
  for (const snap of snapshots) {
    await repo.upsertSnapshot(client, snap, actorId);
  }
  return repo.listAtivos(client);
}