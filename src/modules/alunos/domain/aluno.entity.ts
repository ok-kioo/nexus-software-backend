export interface Aluno {
  id: string;
  nome_aluno: string;
  documento: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}