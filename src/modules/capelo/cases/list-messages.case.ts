import type { CapeloRepository } from "../domain/capelo.repository";
import type { CapeloListQuery, CapeloMessage } from "../dto/capelo.dto";
export async function listMessagesCase(
  repo: CapeloRepository,
  userId: string,
  query: CapeloListQuery,
): Promise<{ rows: CapeloMessage[]; hasMore: boolean }> {
  const rows = await repo.list(userId, { limit: query.limit, before: query.before });
  // Se obteve `limit` itens, presume que há mais (cursor anterior).
  const hasMore = rows.length === query.limit;
  return { rows, hasMore };
}