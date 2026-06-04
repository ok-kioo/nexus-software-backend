export type AlertaSeverity = "critico" | "atencao" | "informativo";
export type AlertaStatus = "ativo" | "resolvido" | "ignorado" | "convertido";
export type AlertaTipo = "risco-aluno" | "freq-turma" | "ocup-turma" | "rede-risco";
export type AlertaEntidade = "aluno" | "turma" | "rede";

export interface Alerta {
  id: string;
  tipo: AlertaTipo;
  severity: AlertaSeverity;
  entidade: AlertaEntidade;
  entidade_id: string | null;
  titulo: string;
  descricao: string;
  unidade: string | null;
  unidade_id: string | null;
  metricas: Record<string, unknown>;
  status: AlertaStatus;
  plano_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Snapshot computado em memória, antes de virar linha persistida. */
export interface AlertaSnapshot {
  tipo: AlertaTipo;
  severity: AlertaSeverity;
  entidade: AlertaEntidade;
  entidade_id: string | null;
  titulo: string;
  descricao: string;
  unidade: string | null;
  unidade_id: string | null;
  metricas: Record<string, unknown>;
}

export interface AlertaHistorico {
  id: string;
  alerta_id: string;
  evento: "detected" | "reseen" | "status_change" | "promoted";
  payload: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}