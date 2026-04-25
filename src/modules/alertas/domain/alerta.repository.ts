import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../../../infra/shared/db-errors";
import type { Alerta, AlertaHistorico, AlertaSnapshot, AlertaStatus } from "./alerta.entity";

export interface AlertaRepository {
  listAtivos(client: SupabaseClient): Promise<Alerta[]>;
  list(client: SupabaseClient, filters: { status?: AlertaStatus }): Promise<Alerta[]>;
  getById(client: SupabaseClient, id: string): Promise<Alerta | null>;
  upsertSnapshot(client: SupabaseClient, snap: AlertaSnapshot, actorId: string | null): Promise<Alerta>;
  updateStatus(
    client: SupabaseClient,
    id: string,
    status: AlertaStatus,
    actorId: string | null,
    extra?: { plano_id?: string | null },
  ): Promise<Alerta | null>;
  insertHistorico(
    client: SupabaseClient,
    alertaId: string,
    evento: AlertaHistorico["evento"],
    payload: Record<string, unknown>,
    actorId: string | null,
  ): Promise<void>;
  listHistorico(client: SupabaseClient, alertaId: string): Promise<AlertaHistorico[]>;
}

export class SupabaseAlertaRepository implements AlertaRepository {
  async listAtivos(client: SupabaseClient): Promise<Alerta[]> {
    const { data, error } = await client
      .from("alertas")
      .select("*")
      .eq("status", "ativo")
      .order("severity", { ascending: true })
      .order("last_seen_at", { ascending: false });
    if (error) throw dbError(error);
    return (data ?? []) as Alerta[];
  }

  async list(client: SupabaseClient, filters: { status?: AlertaStatus }): Promise<Alerta[]> {
    let q = client.from("alertas").select("*").order("last_seen_at", { ascending: false });
    if (filters.status) q = q.eq("status", filters.status);
    const { data, error } = await q;
    if (error) throw dbError(error);
    return (data ?? []) as Alerta[];
  }

  async getById(client: SupabaseClient, id: string): Promise<Alerta | null> {
    const { data, error } = await client.from("alertas").select("*").eq("id", id).maybeSingle();
    if (error) throw dbError(error);
    return (data as Alerta | null) ?? null;
  }

  async upsertSnapshot(client: SupabaseClient, snap: AlertaSnapshot, actorId: string | null): Promise<Alerta> {
    // 1) Procurar alerta ATIVO com mesma (tipo, entidade_id)
    const eq = snap.entidade_id
      ? client.from("alertas").select("*").eq("tipo", snap.tipo).eq("status", "ativo").eq("entidade_id", snap.entidade_id)
      : client.from("alertas").select("*").eq("tipo", snap.tipo).eq("status", "ativo").is("entidade_id", null);

    const { data: existing, error: selErr } = await eq.maybeSingle();
    if (selErr && (selErr as { code?: string }).code !== "PGRST116") throw dbError(selErr);

    if (existing) {
      const { data: updated, error: updErr } = await client
        .from("alertas")
        .update({
          last_seen_at: new Date().toISOString(),
          severity: snap.severity,
          titulo: snap.titulo,
          descricao: snap.descricao,
          unidade: snap.unidade,
          unidade_id: snap.unidade_id,
          metricas: snap.metricas,
        })
        .eq("id", (existing as Alerta).id)
        .select()
        .single();
      if (updErr) throw dbError(updErr);
      await this.insertHistorico(client, (updated as Alerta).id, "reseen", { metricas: snap.metricas }, actorId);
      return updated as Alerta;
    }

    const { data: inserted, error: insErr } = await client
      .from("alertas")
      .insert({
        tipo: snap.tipo,
        severity: snap.severity,
        entidade: snap.entidade,
        entidade_id: snap.entidade_id,
        titulo: snap.titulo,
        descricao: snap.descricao,
        unidade: snap.unidade,
        unidade_id: snap.unidade_id,
        metricas: snap.metricas,
      })
      .select()
      .single();
    if (insErr) throw dbError(insErr);
    await this.insertHistorico(client, (inserted as Alerta).id, "detected", { metricas: snap.metricas }, actorId);
    return inserted as Alerta;
  }

  async updateStatus(
    client: SupabaseClient,
    id: string,
    status: AlertaStatus,
    actorId: string | null,
    extra?: { plano_id?: string | null },
  ): Promise<Alerta | null> {
    const patch: Record<string, unknown> = { status };
    if (status === "resolvido" || status === "ignorado" || status === "convertido") {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = actorId;
    }
    if (extra?.plano_id !== undefined) patch.plano_id = extra.plano_id;

    const { data, error } = await client.from("alertas").update(patch).eq("id", id).select().maybeSingle();
    if (error) throw dbError(error, 400);
    if (data) {
      await this.insertHistorico(client, id, "status_change", { status, ...(extra ?? {}) }, actorId);
    }
    return (data as Alerta | null) ?? null;
  }

  async insertHistorico(
    client: SupabaseClient,
    alertaId: string,
    evento: AlertaHistorico["evento"],
    payload: Record<string, unknown>,
    actorId: string | null,
  ): Promise<void> {
    const { error } = await client.from("alerta_historico").insert({
      alerta_id: alertaId,
      evento,
      payload,
      actor_id: actorId,
    });
    if (error) {
      // Não derruba a operação principal
      // eslint-disable-next-line no-console
      console.error("[backend][alerta-historico]", error);
    }
  }

  async listHistorico(client: SupabaseClient, alertaId: string): Promise<AlertaHistorico[]> {
    const { data, error } = await client
      .from("alerta_historico")
      .select("*")
      .eq("alerta_id", alertaId)
      .order("created_at", { ascending: false });
    if (error) throw dbError(error);
    return (data ?? []) as AlertaHistorico[];
  }
}

export const alertaRepository: AlertaRepository = new SupabaseAlertaRepository();