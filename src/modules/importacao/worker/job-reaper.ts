import { ImportJobRepository } from "../domain/import-job.repository";

/**
 * No startup do servidor, marca como 'failed' qualquer job que ficou preso
 * num estado intermediário por mais de 30 minutos (provavelmente um restart
 * derrubou o processamento). Isso evita jobs zumbis "Em andamento" para sempre.
 */
export async function startJobReaper(): Promise<void> {
  const repo = new ImportJobRepository();
  try {
    const stale = await repo.findStaleProcessing(30);
    for (const job of stale) {
      await repo.markFailed(
        job.id,
        "Processamento interrompido por reinício do servidor. Tente importar novamente.",
      );
    }
    if (stale.length > 0) {
      console.log(`[job-reaper] reaped ${stale.length} stale import job(s)`);
    }
  } catch (e) {
    const msg = (e as Error).message ?? "";
    // Silencia erro 42501 (permission denied): comum em DB local sem service_role
    // configurada corretamente. Logado em modo discreto para não poluir o boot.
    if (msg.includes("permission denied")) {
      console.warn(
        "[job-reaper] sem permissão para varrer jobs antigos — verifique SUPABASE_SERVICE_ROLE_KEY",
      );
    } else {
      console.warn("[job-reaper] failed to scan stale jobs", msg);
    }
  }
}