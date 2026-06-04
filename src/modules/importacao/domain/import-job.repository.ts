import { createAdminClient, type SupabaseAdmin } from "../../../infra/database/supabase-client";
import type { ImportJob, ImportJobStatus, EntitySummary, ValidationError } from "./import-job.entity";

const TABLE = "import_jobs";

export class ImportJobRepository {
  private client: SupabaseAdmin;
  constructor(client?: SupabaseAdmin) {
    this.client = client ?? createAdminClient();
  }

  async create(input: {
    user_id: string;
    file_name: string;
    file_size_bytes: number;
    storage_path: string;
  }): Promise<ImportJob> {
    const { data, error } = await this.client
      .from(TABLE)
      .insert({ ...input, status: "queued" as ImportJobStatus, progress_pct: 0 })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Falha ao criar import_job");
    return data as unknown as ImportJob;
  }

  async findById(id: string): Promise<ImportJob | null> {
    const { data, error } = await this.client.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as unknown as ImportJob) ?? null;
  }

  async listByUser(
    userId: string,
    opts: { page?: number; pageSize?: number; status?: ImportJobStatus; isAdmin?: boolean } = {},
  ): Promise<{ rows: ImportJob[]; total: number }> {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let q = this.client.from(TABLE).select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (!opts.isAdmin) q = q.eq("user_id", userId);
    if (opts.status) q = q.eq("status", opts.status);
    const { data, count, error } = await q.range(from, to);
    if (error) throw new Error(error.message);
    return { rows: (data as unknown as ImportJob[]) ?? [], total: count ?? 0 };
  }

  async update(id: string, patch: Partial<ImportJob>): Promise<void> {
    const { error } = await this.client.from(TABLE).update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async getStatus(id: string): Promise<ImportJobStatus | null> {
    const { data, error } = await this.client.from(TABLE).select("status").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.status as ImportJobStatus) ?? null;
  }

  async markStarted(id: string, totalRows: number, totalChunks: number) {
    await this.update(id, {
      status: "parsing",
      started_at: new Date().toISOString(),
      total_rows: totalRows,
      total_chunks: totalChunks,
    });
  }

  async markCompleted(id: string, summary: EntitySummary[], errors: ValidationError[]) {
    const inserted = summary.reduce((a, s) => a + s.inserted, 0);
    const skipped = summary.reduce((a, s) => a + s.skipped, 0);
    await this.update(id, {
      status: "completed",
      progress_pct: 100,
      current_step: "Concluído",
      finished_at: new Date().toISOString(),
      result_summary: summary,
      validation_errors: errors,
      inserted_count: inserted,
      skipped_count: skipped,
    });
  }

  async markFailed(id: string, message: string) {
    await this.update(id, {
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: message,
    });
  }

  async markCancelled(id: string) {
    await this.update(id, {
      status: "cancelled",
      finished_at: new Date().toISOString(),
      current_step: "Cancelado pelo usuário",
    });
  }

  async findStaleProcessing(maxAgeMinutes = 30): Promise<ImportJob[]> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .in("status", ["parsing", "validating", "persisting"])
      .lt("updated_at", cutoff);
    if (error) throw new Error(error.message);
    return (data as unknown as ImportJob[]) ?? [];
  }
}