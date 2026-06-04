import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ZodTypeAny } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../database/supabase-client";
import { requireRole, userClient } from "../http/auth-middleware";
import type { UserRole } from "./roles";
import { parsePage, parsePageSize } from "./utils";
import { dbError } from "./db-errors";

export interface CrudConfig {
  table: string;
  searchColumns?: string[];
  defaultOrder?: { column: string; ascending?: boolean };
  filterColumns?: string[];
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  readRoles: UserRole[];
  writeRoles: UserRole[];
  deleteRoles: UserRole[];
  /**
   * Como construir o cliente Supabase para cada request.
   *  - "user" (padrão): usa o JWT do usuário, RLS aplicada.
   *  - "admin": usa service-role key, RLS bypassed. Use somente quando
   *    a operação precisa cruzar fronteiras de RLS legitimamente.
   */
  clientMode?: "user" | "admin";
}

function getClient(c: Context, mode: CrudConfig["clientMode"]): SupabaseClient {
  return mode === "admin" ? createAdminClient() : userClient(c);
}

/**
 * Helper opcional para CRUDs triviais. Usado dentro do controller do módulo,
 * NÃO como roteador externo. Mantém compatibilidade com o padrão antigo.
 */
export function createCrudRouter(cfg: CrudConfig): Hono {
  const router = new Hono();
  const mode: CrudConfig["clientMode"] = cfg.clientMode ?? "user";

  router.get("/", async (c) => {
    requireRole(c, cfg.readRoles);
    const page = parsePage(c.req.query("page"));
    const pageSize = parsePageSize(c.req.query("pageSize"));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const search = c.req.query("search")?.trim() ?? "";
    const client = getClient(c, mode);
    let q = client.from(cfg.table).select("*", { count: "exact" });
    if (cfg.defaultOrder) {
      q = q.order(cfg.defaultOrder.column, { ascending: cfg.defaultOrder.ascending ?? true });
    }
    if (search && cfg.searchColumns?.length) {
      q = q.or(cfg.searchColumns.map((col) => `${col}.ilike.%${search}%`).join(","));
    }
    for (const col of cfg.filterColumns ?? []) {
      const value = c.req.query(col);
      if (value && value !== "all") q = q.eq(col, value);
    }
    const { data, error, count } = await q.range(from, to);
    if (error) throw dbError(error);
    return c.json({ rows: data ?? [], total: count ?? 0, page, pageSize });
  });

  router.get("/:id", async (c) => {
    requireRole(c, cfg.readRoles);
    const client = getClient(c, mode);
    const { data, error } = await client.from(cfg.table).select("*").eq("id", c.req.param("id")).maybeSingle();
    if (error) throw dbError(error);
    if (!data) throw new HTTPException(404, { message: "Não encontrado" });
    return c.json(data);
  });

  router.post("/", async (c) => {
    requireRole(c, cfg.writeRoles);
    const parsed = cfg.createSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const client = getClient(c, mode);
    const { data, error } = await client.from(cfg.table).insert(parsed.data as Record<string, unknown>).select().maybeSingle();
    if (error) throw dbError(error, 400);
    return c.json(data, 201);
  });

  router.patch("/:id", async (c) => {
    requireRole(c, cfg.writeRoles);
    const parsed = cfg.updateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const client = getClient(c, mode);
    const { data, error } = await client
      .from(cfg.table)
      .update(parsed.data as Record<string, unknown>)
      .eq("id", c.req.param("id"))
      .select()
      .maybeSingle();
    if (error) throw dbError(error, 400);
    if (!data) throw new HTTPException(404, { message: "Não encontrado" });
    return c.json(data);
  });

  router.delete("/:id", async (c) => {
    requireRole(c, cfg.deleteRoles);
    const client = getClient(c, mode);
    const { error } = await client.from(cfg.table).delete().eq("id", c.req.param("id"));
    if (error) throw dbError(error, 400);
    return c.json({ ok: true });
  });

  return router;
}