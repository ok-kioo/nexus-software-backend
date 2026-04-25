import type { SupabaseClient } from "@supabase/supabase-js";
import { HTTPException } from "hono/http-exception";
import { dbError } from "../../../infra/shared/db-errors";
import type { AlertaRepository } from "../domain/alerta.repository";
import type { AlertaPromoteDTO } from "../dto/alerta.dto";

/**
 * Cria um plano_acao a partir de um alerta de aluno e marca o alerta como
 * `convertido`, vinculando `plano_id`. Apenas alertas com `entidade='aluno'`
 * podem ser promovidos diretamente — para turma, recomenda-se criar manualmente.
 */
export async function promoteAlertaToPlanoCase(
  repo: AlertaRepository,
  client: SupabaseClient,
  alertaId: string,
  dto: AlertaPromoteDTO,
  actorId: string,
) {
  const alerta = await repo.getById(client, alertaId);
  if (!alerta) throw new HTTPException(404, { message: "Alerta não encontrado" });
  if (alerta.status !== "ativo") {
    throw new HTTPException(409, { message: "Alerta não está ativo" });
  }
  if (alerta.entidade !== "aluno" || !alerta.entidade_id) {
    throw new HTTPException(400, {
      message: "Apenas alertas de aluno podem ser promovidos a plano de ação automaticamente",
    });
  }

  const planoPayload = {
    aluno_id: alerta.entidade_id,
    titulo: dto.titulo ?? alerta.titulo,
    descricao: dto.descricao ?? alerta.descricao,
    prazo: dto.prazo ?? null,
    prioridade: dto.prioridade ?? (alerta.severity === "critico" ? "alta" : "media"),
    responsavel_id: dto.responsavel_id ?? null,
    origem_alerta: alerta.id,
    criado_por: actorId,
    status: "aberto" as const,
  };

  const { data: plano, error } = await client
    .from("planos_acao")
    .insert(planoPayload)
    .select()
    .single();
  if (error) throw dbError(error, 400);

  const planoId = (plano as { id: string }).id;
  await repo.updateStatus(client, alertaId, "convertido", actorId, { plano_id: planoId });
  await repo.insertHistorico(client, alertaId, "promoted", { plano_id: planoId }, actorId);

  return { plano, alerta_id: alertaId };
}