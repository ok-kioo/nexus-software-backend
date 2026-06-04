export interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  unidade_id: string | null;
  criado_por: string;
  created_at: string;
  updated_at: string;
}