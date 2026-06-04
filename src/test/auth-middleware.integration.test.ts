import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { authMiddleware, requireRole } from "../infra/http/auth-middleware";
import { errorHandler } from "../infra/http/error-handler";

// Mock dos clients Supabase usados internamente por resolveAppUser.
vi.mock("../infra/database/supabase-client", () => {
  function makeUserClient(token: string) {
    return {
      auth: {
        getClaims: async (_t: string) => {
          if (token === "valid-admin" || token === "valid-prof") {
            return {
              data: { claims: { sub: "11111111-1111-4111-8111-111111111111", email: "u@test.com" } },
              error: null,
            };
          }
          return { data: null, error: { message: "invalid" } };
        },
      },
    };
  }
  function makeAdminClient() {
    return {
      from: (table: string) => ({
        select: () => ({
          eq: () => {
            if (table === "profiles") {
              return {
                maybeSingle: async () => ({
                  data: { id: "11111111-1111-4111-8111-111111111111", name: "U", email: "u@test.com" },
                  error: null,
                }),
              };
            }
            // user_roles → resolve com array (await direto)
            const role =
              (globalThis as { __TEST_ROLE__?: string }).__TEST_ROLE__ ?? "administrador";
            const result = { data: [{ role }], error: null };
            return Object.assign(Promise.resolve(result), result);
          },
        }),
      }),
    };
  }
  return {
    createUserClient: (token: string) => makeUserClient(token),
    createAdminClient: () => makeAdminClient(),
  };
});

function buildApp() {
  const app = new Hono();
  app.use("/protected/*", authMiddleware);
  app.get("/protected/admin-only", (c) => {
    requireRole(c, ["administrador"]);
    return c.json({ ok: true });
  });
  app.get("/protected/any", (c) => c.json({ ok: true }));
  app.onError(errorHandler);
  return app;
}

describe("authMiddleware", () => {
  it("401 quando não há header Authorization", async () => {
    const res = await buildApp().request("/protected/any");
    expect(res.status).toBe(401);
  });

  it("401 quando token é inválido", async () => {
    const res = await buildApp().request("/protected/any", {
      headers: { Authorization: "Bearer invalid" },
    });
    expect(res.status).toBe(401);
  });

  it("200 com token válido (admin)", async () => {
    (globalThis as { __TEST_ROLE__?: string }).__TEST_ROLE__ = "administrador";
    const res = await buildApp().request("/protected/any", {
      headers: { Authorization: "Bearer valid-admin" },
    });
    expect(res.status).toBe(200);
  });

  it("403 quando role professor tenta rota admin-only", async () => {
    (globalThis as { __TEST_ROLE__?: string }).__TEST_ROLE__ = "professor";
    const res = await buildApp().request("/protected/admin-only", {
      headers: { Authorization: "Bearer valid-prof" },
    });
    expect(res.status).toBe(403);
  });
});
