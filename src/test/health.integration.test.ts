import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { registerRoutes } from "../routes";

describe("health endpoints (públicos)", () => {
  it("GET /health responde 200", async () => {
    const app = new Hono();
    registerRoutes(app);
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("GET /v1/health responde 200", async () => {
    const app = new Hono();
    registerRoutes(app);
    const res = await app.request("/v1/health");
    expect(res.status).toBe(200);
  });
});
