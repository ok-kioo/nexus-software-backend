import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import { errorHandler } from "../infra/http/error-handler";
import { parseJson, parseQuery, parseUuidParam } from "../infra/http/validation";

describe("validation helpers", () => {
  function app() {
    const a = new Hono();
    const Body = z.object({ titulo: z.string().min(3).max(10) });
    a.post("/body", async (c) => {
      const data = await parseJson(c, Body);
      return c.json(data);
    });
    a.get("/q", (c) => {
      const data = parseQuery(c, z.object({ page: z.coerce.number().int().min(1) }));
      return c.json(data);
    });
    a.get("/u/:id", (c) => c.json({ id: parseUuidParam(c) }));
    a.onError(errorHandler);
    return a;
  }

  it("parseJson retorna 400 com mensagem detalhada", async () => {
    const res = await app().request("/body", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "ab" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/titulo/);
  });

  it("parseJson aceita payload válido", async () => {
    const res = await app().request("/body", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "valido" }),
    });
    expect(res.status).toBe(200);
  });

  it("parseQuery coage tipos", async () => {
    const res = await app().request("/q?page=2");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ page: 2 });
  });

  it("parseUuidParam rejeita id inválido", async () => {
    const res = await app().request("/u/nao-eh-uuid");
    expect(res.status).toBe(400);
  });
});
