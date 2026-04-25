export interface Nota {
  id: string;
  matricula_id: string;
  nota_1: number | null;
  nota_2: number | null;
  nota_3: number | null;
  nota_4: number | null;
  observacao: string | null;
  registrado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotasByTurmaResult {
  matriculas: unknown[];
  registros: unknown[];
}