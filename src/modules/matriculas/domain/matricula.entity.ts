export interface Matricula {
  id: string;
  numero_matricula: string;
  aluno_id: string;
  turma_id: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatriculaListFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
  unidadeId?: string;
  cursoId?: string;
  turmaId?: string;
}