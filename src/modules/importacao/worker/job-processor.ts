import { createAdminClient } from "../../../infra/database/supabase-client";
import { ImportJobRepository } from "../domain/import-job.repository";
import { JobProgressReporter } from "./job-progress-reporter";
import { parseWorkbook, ParseError } from "../cases/parse-workbook.case";
import { validateWorkbook } from "../cases/validate-workbook.case";
import { persistWorkbook } from "../cases/persist-workbook.case";

const MAX_CONCURRENT_JOBS = 2;
let running = 0;
const queue: string[] = [];

function tryStart(jobId: string) {
  if (running >= MAX_CONCURRENT_JOBS) {
    queue.push(jobId);
    return;
  }
  running++;
  // Não bloqueia o handler HTTP
  setImmediate(() => {
    processJob(jobId)
      .catch((err) => console.error(`[job-processor] job ${jobId} crashed`, err))
      .finally(() => {
        running--;
        const next = queue.shift();
        if (next) tryStart(next);
      });
  });
}

/** Ponto de entrada usado pelo controller após criar o registro do job. */
export function enqueueJob(jobId: string) {
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

    // 1. Baixa arquivo do Storage
    reporter.setStep("parsing", "Baixando arquivo", 2);
    await reporter.flush();
    const { data: blob, error: dlErr } = await admin.storage
      .from("import-uploads")
      .download(job.storage_path);
    if (dlErr || !blob) throw new Error(`Falha ao baixar arquivo: ${dlErr?.message ?? "desconhecido"}`);
    const buffer = Buffer.from(await blob.arrayBuffer());

    if (await isCancelled()) return;

    // 2. Parse
    reporter.setStep("parsing", "Lendo planilha", 8);
    await reporter.flush();
    const parsed = await parseWorkbook(buffer);
    await repo.markStarted(jobId, parsed.totalRows, 0); // total_chunks atualizado depois
    reporter.setStep("parsing", "Planilha lida", 25);
    await reporter.flush();

    if (await isCancelled()) return;

    // 3. Validação (paralelo por chunks)
    reporter.setStep("validating", "Validando linhas", 25);
    const { entities, errors } = await validateWorkbook(parsed.sheets, (done, total) => {
      const pct = 25 + (done / total) * 25;
      reporter.setStep("validating", `Validando linhas (${done}/${total} lotes)`, pct);
    });
    await reporter.flush();

    if (await isCancelled()) return;

    // 4. Persistência (paralelo por chunks dentro de cada entidade)
    reporter.setStep("persisting", "Gravando dados", 50);
    await reporter.flush();
    const summary = await persistWorkbook(entities, {
      isCancelled,
      onProgress: (done, total, entityName) => {
        const pct = 50 + (done / total) * 48;
        reporter.set({ processed_chunks: done, total_chunks: total });
        reporter.setStep("persisting", `Gravando ${entityName} (${done}/${total})`, pct);
      },
    });
    await reporter.flush();

    if (await isCancelled()) return;

    // 5. Conclusão
    await repo.markCompleted(jobId, summary, errors);
  } catch (err) {
    if ((err as Error).message === "Importação cancelada") {
      await repo.markCancelled(jobId);
      return;
    }
    const msg = err instanceof ParseError ? err.message : (err as Error).message ?? "Falha ao processar";
    console.error(`[job-processor] job ${jobId} failed:`, err);
    await repo.markFailed(jobId, msg);
  }
}