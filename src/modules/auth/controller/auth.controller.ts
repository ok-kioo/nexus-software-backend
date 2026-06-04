import { Hono } from "hono";
import { getAuth } from "../../../infra/http/auth-middleware";

export function authController(): Hono {
  const router = new Hono();
  router.get("/me", (c) => {
    const { user } = getAuth(c);
    return c.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles,
      },
    });
  });
  return router;
}