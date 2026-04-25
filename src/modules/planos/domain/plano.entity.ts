export interface Plano {
  id: string;
  aluno_id: string;
  titulo: string;
  descricao: string;
  prioridade: string;
  status: string;
  responsavel_id: string | null;
  prazo: string | null;
  origem_alerta: string | null;
  criado_por: string;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
}