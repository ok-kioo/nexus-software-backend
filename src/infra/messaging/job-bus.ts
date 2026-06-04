import { EventEmitter } from "node:events";

/**
 * Pub/sub tipado para eventos do pipeline de importação.
 * Em processo (substitui polling/queue ad-hoc).
 * Pronto para ser substituído por Redis/SQS no futuro mantendo a mesma API.
 */
export type JobEvent =
  | { type: "job.queued"; jobId: string; mode: "single" | "batched" }
  | { type: "job.progress"; jobId: string; pct: number; step: string }
  | { type: "job.completed"; jobId: string }
  | { type: "job.failed"; jobId: string; message: string }
  | { type: "job.cancelled"; jobId: string };

class JobBus {
  private emitter = new EventEmitter();
  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publish(event: JobEvent): void {
    this.emitter.emit("event", event);
    this.emitter.emit(event.type, event);
  }

  on(type: JobEvent["type"], handler: (e: JobEvent) => void): () => void {
    this.emitter.on(type, handler);
    return () => this.emitter.off(type, handler);
  }

  /** Subscreve a TODOS os eventos. Útil para logs/observabilidade. */
  onAny(handler: (e: JobEvent) => void): () => void {
    this.emitter.on("event", handler);
    return () => this.emitter.off("event", handler);
  }
}

/** Singleton in-process. */
export const jobBus = new JobBus();