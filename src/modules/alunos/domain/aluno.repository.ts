import type { Aluno } from "./aluno.entity";

export interface AlunoRepository {
  list(): Promise<Aluno[]>;
}