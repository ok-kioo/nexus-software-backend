import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { avisoController } from "../modules/avisos/controller/aviso.controller";
import { errorHandler } from "../infra/http/error-handler";
import type { AuthContextValue } from "../infra/shared/types";
import { makeUser } from "./helpers";
import type { UserRole } from "../infra/shared/roles";

vi.mock("../modules/avisos/cases/aviso.cases", () => ({
  listAvisosCase: vi.fn(async () => [{ id: "1", titulo: "A" }]),
  createAvisoCase: vi.fn(async (_repo: unknown, dto: unknown, autorId: string) => ({ id: "new", ...(dto as object), autor_id: autorId })),
  updateAvisoCase: vi.fn(async () => ({ id: "1" })),
  deleteAvisoCase: vi.fn(async () => undefined),
  listLeiturasCase: vi.fn(async () => []),
  markReadCase: vi.fn(async () => undefined),
}));

function build(role: UserRole | null = "administrador") {
  const app = new Hono();
  app.use("*", async (c: any, next) => {
    if (role) {
      c.set("auth", { token: "t", user: makeUser(role) } satisfies AuthContextValue);
    }
    await next();
  });
  app.route("/v1/avisos", avisoController());
  app.onError(errorHandler);
  return app;
}

describe("/v1/avisos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET / lista", async () => {
    const res = await build().request("/v1/avisos");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: unknown[]; total: number };
    expect(body.total).toBe(1);
  });

  it("POST / com payload inválido → 400", async () => {
    const res = await build("administrador").request("/v1/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST / com role professor → 403", async () => {
    const res = await build("professor").request("/v1/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "ok", corpo: "ok" }),
    });
    expect(res.status).toBe(403);
  });

  it("POST / como admin com payload válido → 201", async () => {
    const res = await build("administrador").request("/v1/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "Aviso", corpo: "Conteúdo" }),
    });
    expect(res.status).toBe(201);
  });
});
