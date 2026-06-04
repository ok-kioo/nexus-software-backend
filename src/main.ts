import { z, locales } from "zod";
z.config(locales.pt());
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { swaggerUI } from "@hono/swagger-ui";
import { config } from "./infra/config/env";
import { errorHandler } from "./infra/http/error-handler";
import { requestLogger } from "./infra/http/request-logger";
import { registerRoutes } from "./routes";
import { openapiDocument } from "./infra/http/openapi";
import { startJobReaper } from "./modules/importacao/worker/job-reaper";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.corsOrigin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use("*", requestLogger);

// OpenAPI / Swagger UI — públicos
app.get("/docs/openapi.json", (c) => c.json(openapiDocument));
app.get("/docs", swaggerUI({ url: "/docs/openapi.json" }));

registerRoutes(app);

app.onError(errorHandler);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`[nexus-backend] listening on http://localhost:${info.port}`);
  void startJobReaper();
});
