import { createAdminClient } from "../../../infra/database/supabase-client";
import { ImportJobRepository } from "../domain/import-job.repository";
import { JobProgressReporter } from "./job-progress-reporter";
import { parseWorkbook, ParseError } from "../cases/parse-workbook.case";
import { validateWorkbook } from "../cases/validate-workbook.case";
import { persistWorkbook } from "../cases/persist-workbook.case";
import { jobBus } from "../../../infra/messaging/job-bus";
import type { ImportEntityKey } from "../../../infra/shared/import-validators";

const MAX_CONCURRENT_JOBS = 2;
let running = 0;
const queue: string[] = [];
const jobModes = new Map<string, "single" | "batched">();

const SINGLE_MODE_MAX_BYTES = 10 * 1024 * 1024;

function tryStart(jobId: string) {
  if (running >= MAX_CONCURRENT_JOBS) {
    queue.push(jobId);
    return;
  }
  running++;
  setImmediate(() => {
    processJob(jobId)
      .catch((err) => console.error(`[job-processor] job ${jobId} crashed`, err))
      .finally(() => {
        running--;
        jobModes.delete(jobId);
        const next = queue.shift();
        if (next) tryStart(next);
      });
  });
}

export function enqueueJob(jobId: string, mode?: "single" | "batched") {
  if (mode) jobModes.set(jobId, mode);
  jobBus.publish({ type: "job.queued", jobId, mode: mode ?? "batched" });
  tryStart(jobId);
}

async function processJob(jobId: string) {
  const repo = new ImportJobRepository();
  const reporter = new JobProgressReporter(jobId, repo);
  const admin = createAdminClient();

  const isCancelled = async () => {
    const status = await repo.getStatus(jobId);
    return status === "cancelled";
  };

  try {
    const job = await repo.findById(jobId);
    if (!job) return;
    if (job.status === "cancelled") return;

    const mode: "single" | "batched" =
      jobModes.get(jobId) ??
      (job.file_size_bytes <= SINGLE_MODE_MAX_BYTES ? "single" : "batched");

    const selectedEntities =
      ((job as unknown as { selected_entities?: string[] }).selected_entities ?? null) as
        | ImportEntityKey[]
        | null;

    reporter.setStep("parsing", "Baixando arquivo", 2);
    await reporter.flush();
    const { data: blob, error: dlErr } = await admin.storage
      .from("import-uploads")
      .download(job.storage_path);
    if (dlErr || !blob) throw new Error(`Falha ao baixar arquivo: ${dlErr?.message ?? "desconhecido"}`);
    const buffer = Buffer.from(await blob.arrayBuffer());

    if (await isCancelled()) return;

    reporter.setStep("parsing", "Lendo planilha", 8);
    await reporter.flush();
    const parsed = await parseWorkbook(buffer);
    await repo.markStarted(jobId, parsed.totalRows, 0);
    reporter.setStep("parsing", "Planilha lida", 25);
    await reporter.flush();

    if (await isCancelled()) return;

    // Aplica o filtro de entidades selecionadas já no parse, para validar/persistir só o que o usuário pediu.
    const sheetsToProcess =
      selectedEntities && selectedEntities.length > 0
        ? parsed.sheets.filter((s) => s.entity && selectedEntities.includes(s.entity))
        : parsed.sheets;

    reporter.setStep("validating", "Validando linhas", 25);
    const { entities, errors } = await validateWorkbook(sheetsToProcess, (done, total) => {
      const pct = 25 + (done / total) * 25;
      reporter.setStep("validating", `Validando linhas (${done}/${total} lotes)`, pct);
      jobBus.publish({ type: "job.progress", jobId, pct, step: "validating" });
    });
    await reporter.flush();

    if (await isCancelled()) return;

    reporter.setStep("persisting", "Gravando dados", 50);
    await reporter.flush();
    const summary = await persistWorkbook(entities, {
      mode,
      isCancelled,
      selectedEntities: selectedEntities ?? undefined,
      onProgress: (done, total, entityName) => {
        const pct = 50 + (done / total) * 48;
        reporter.set({ processed_chunks: done, total_chunks: total });
        reporter.setStep("persisting", `Gravando ${entityName} (${done}/${total})`, pct);
        jobBus.publish({ type: "job.progress", jobId, pct, step: `persisting:${entityName}` });
      },
    });
    await reporter.flush();

    if (await isCancelled()) return;

    // Importação parcial é OK. Só falha em erro fatal antes daqui (parse/IO/cancel).
    // Se nada foi inserido E não houve erros, ainda assim concluímos — base já estava sincronizada.
    await repo.markCompleted(jobId, summary, errors);
    jobBus.publish({ type: "job.completed", jobId });
  } catch (err) {
    if ((err as Error).message === "Importação cancelada") {
      await repo.markCancelled(jobId);
      jobBus.publish({ type: "job.cancelled", jobId });
      return;
    }
    const msg = err instanceof ParseError ? err.message : (err as Error).message ?? "Falha ao processar";
    console.error(`[job-processor] job ${jobId} failed:`, err);
    await repo.markFailed(jobId, msg);
    jobBus.publish({ type: "job.failed", jobId, message: msg });
  }
}
