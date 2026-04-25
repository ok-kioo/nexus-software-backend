export interface Frequencia {
  id: string;
  matricula_id: string;
  data: string;
  presente: boolean;
  observacao: string | null;
  registrado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface FrequenciaByTurmaResult {
  matriculas: unknown[];
  registros: unknown[];
}