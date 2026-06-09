import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getAuth } from "../../../infra/http/auth-middleware";
import { CapeloListQuerySchema, CapeloSendSchema } from "../dto/capelo.dto";
import { capeloRepository } from "../domain/capelo.repository";
import { listMessagesCase } from "../cases/list-messages.case";
import { sendMessageCase } from "../cases/send-message.case";
import { clearConversationCase } from "../cases/clear-conversation.case";

export function capeloController(): Hono {
  const router = new Hono();

  router.get("/messages", async (c) => {
    const { user } = getAuth(c);
    const parsed = CapeloListQuerySchema.safeParse({
      limit: c.req.query("limit"),
      before: c.req.query("before"),
    });
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Query inválida" });
    }
    const result = await listMessagesCase(capeloRepository, user.id, parsed.data);
    return c.json(result);
  });

  router.post("/messages", async (c) => {
    const { user } = getAuth(c);
    const contentType = c.req.header("Content-Type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new HTTPException(415, { message: "Content-Type deve ser application/json" });
    }
    const raw = await c.req.text();
    if (raw.length > 8 * 1024) {
      throw new HTTPException(413, { message: "Payload muito grande" });
    }
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new HTTPException(400, { message: "JSON inválido" });
    }
    const parsed = CapeloSendSchema.safeParse(body);
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    // Nunca logar parsed.data.content — pode conter PII do usuário.
    const result = await sendMessageCase(capeloRepository, user.id, parsed.data.content);
    return c.json(result, 201);
  });

  router.delete("/messages", async (c) => {
    const { user } = getAuth(c);
    await clearConversationCase(capeloRepository, user.id);
    return c.json({ ok: true });
  });

  return router;
}
