/**
 * Executa `worker` sobre `items` com no máximo `limit` execuções simultâneas,
 * preservando a ordem dos resultados. Usado para paralelizar inserts/validações
 * em lotes (chunks) sem estourar o pool de conexões.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  if (items.length === 0) return results;
  const concurrency = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  let done = 0;

  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      if (signal?.aborted) return;
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
      done++;
      onProgress?.(done, items.length);
    }
  });

  await Promise.all(runners);
  return results;
}

/** Quebra um array em sub-arrays de tamanho `size`. */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be > 0");
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}