import { ImportJobRepository } from "../domain/import-job.repository";
import type { ImportJob, ImportJobStatus } from "../domain/import-job.entity";

/**
 * Acumula updates de progresso em memória e faz flush para o banco no máximo
 * a cada `intervalMs` ou após `chunkBurst` lotes processados (o que vier antes).
 * Evita centenas de UPDATEs por segundo durante imports grandes.
 */
export class JobProgressReporter {
  private repo: ImportJobRepository;
  private jobId: string;
  private pending: Partial<ImportJob> = {};
  private timer: ReturnType<typeof setTimeout> | null = null;
  private bursts = 0;
  private readonly intervalMs: number;
  private readonly chunkBurst: number;

  constructor(jobId: string, repo?: ImportJobRepository, intervalMs = 500, chunkBurst = 10) {
    this.jobId = jobId;
    this.repo = repo ?? new ImportJobRepository();
    this.intervalMs = intervalMs;
    this.chunkBurst = chunkBurst;
  }

  set(patch: Partial<ImportJob>) {
    this.pending = { ...this.pending, ...patch };
    this.bursts++;
    if (this.bursts >= this.chunkBurst) {
      void this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), this.intervalMs);
    }
  }

  setStep(status: ImportJobStatus, step: string, pct: number) {
    this.set({ status, current_step: step, progress_pct: Math.max(0, Math.min(100, Math.round(pct))) });
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.bursts = 0;
    const patch = this.pending;
    if (Object.keys(patch).length === 0) return;
    this.pending = {};
    try {
      await this.repo.update(this.jobId, patch);
    } catch (e) {
      // Não interrompe o pipeline por falha de update de progresso
      console.warn("[job-progress-reporter] update failed", e);
    }
  }
}