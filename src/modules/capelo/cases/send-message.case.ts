import { HTTPException } from "hono/http-exception";
import type { CapeloRepository } from "../domain/capelo.repository";
import { sanitizeContent, type CapeloMessage } from "../dto/capelo.dto";
import {
  sendChat,
  CapeloHttpError,
  CapeloNetworkError,
  CapeloTimeoutError,
  CapeloEmptyReplyError,
} from "../infra/n8n-client";

export interface SendMessageResult {
  user: CapeloMessage;
  assistant: CapeloMessage;
}

export async function sendMessageCase(
  repo: CapeloRepository,
  userId: string,
  rawContent: string,
): Promise<SendMessageResult> {
  const content = sanitizeContent(rawContent).trim();
  if (!content) throw new HTTPException(400, { message: "Mensagem vazia" });

  // 1) Persiste mensagem do usuário primeiro (audita mesmo se IA falhar).
  const userMsg = await repo.insert(userId, "user", content);

  // 2) Chama o agente externo.
  let reply: string;
  try {
    reply = await sendChat({ chatInput: content, sessionId: userId, userId });
  } catch (err) {
    if (err instanceof CapeloTimeoutError) {
      throw new HTTPException(504, { message: "O Capelo demorou para responder. Tente novamente." });
    }
    if (err instanceof CapeloHttpError) {
      throw new HTTPException(502, { message: "O Capelo está indisponível no momento." });
    }
    if (err instanceof CapeloEmptyReplyError) {
      throw new HTTPException(502, { message: "O Capelo não retornou resposta." });
    }
    if (err instanceof CapeloNetworkError) {
      throw new HTTPException(502, { message: "Não foi possível contatar o Capelo." });
    }
    throw err;
  }

  // 3) Persiste resposta.
  const assistantMsg = await repo.insert(userId, "assistant", reply);
  return { user: userMsg, assistant: assistantMsg };
}
