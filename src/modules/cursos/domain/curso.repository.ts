import type { Curso } from "./curso.entity";

export interface CursoRepository {
  list(): Promise<Curso[]>;
}