export interface Turma {
  id: string;
  nome_turma: string;
  unidade_id: string;
  curso_id: string;
  capacidade: number;
  periodo: string | null;
  turno: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TurmaWithRelations extends Turma {
  curso?: { id: string; nome_curso: string } | null;
  unidade?: { id: string; nome_unidade: string; estado: string } | null;
  matriculas?: Array<{ id: string; status: string }>;
}