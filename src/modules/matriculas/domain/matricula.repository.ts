import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatriculaListFilters } from "./matricula.entity";

export interface PagedRelations {
  rows: unknown[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MatriculaRepository {
  listWithRelations(client: SupabaseClient, filters: MatriculaListFilters): Promise<PagedRelations>;
}

export { matriculaRepository } from "../../../infra/database/repositories/matricula.repository";