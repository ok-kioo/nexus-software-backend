import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertaRepository } from "../domain/alerta.repository";
import type { AlertaStatus } from "../domain/alerta.entity";

export function listAlertasCase(
  repo: AlertaRepository,
  client: SupabaseClient,
  filters: { status?: AlertaStatus } = {},
) {
  return repo.list(client, filters);
}

export function getAlertaDetailCase(repo: AlertaRepository, client: SupabaseClient, id: string) {
  return Promise.all([repo.getById(client, id), repo.listHistorico(client, id)]).then(
    ([alerta, historico]) => ({ alerta, historico }),
  );
}