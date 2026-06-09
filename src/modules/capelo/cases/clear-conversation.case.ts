import type { CapeloRepository } from "../domain/capelo.repository";

export async function clearConversationCase(repo: CapeloRepository, userId: string): Promise<void> {
  await repo.clear(userId);
}
