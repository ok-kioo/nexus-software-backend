export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  acao: string;
  entidade: string;
  registro_id: string | null;
  dados_antes: unknown;
  dados_depois: unknown;
  created_at: string;
}

export interface AuditFilters {
  entidade?: string;
  acao?: string;
  user_id?: string;
  limit?: number;
}