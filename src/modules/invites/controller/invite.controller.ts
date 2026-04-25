import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { getAuth, requireRole } from "../../../infra/http/auth-middleware";
import { ADMIN_GESTOR_ROLES, ADMIN_ONLY, canAssignRole } from "../../../infra/shared/roles";
import type { UserRole } from "../../../infra/shared/roles";
import { createAdminClient, createUserClient } from "../../../infra/database/supabase-client";
import { cleanOrigin } from "../../../infra/shared/utils";
import { dbError } from "../../../infra/shared/db-errors";
import {
  AcceptInviteSchema,
  InviteCreateSchema,
  InviteResendSchema,
  TestInviteSchema,
} from "../dto/invite.dto";

function inviteAcceptUrl(origin: string, token: string) {
  return `${cleanOrigin(origin)}/aceitar-convite?token=${token}`;
}

export function inviteController(): Hono {
  const router = new Hono();

  router.get("/", async (c) => {
    const { user } = getAuth(c);
    requireRole(c, ADMIN_GESTOR_ROLES);
    const admin = createAdminClient();
    let query = admin
      .from("invites")
      .select("id,email,role,status,expires_at,created_at,token,turma_ids,invited_by")
      .order("created_at", { ascending: false });
    if (user.role === "gestor") query = query.eq("invited_by", user.id);
    const { data, error } = await query;
    if (error) throw dbError(error);
    return c.json({ rows: data ?? [] });
  });

  router.post("/", async (c) => {
    const auth = getAuth(c);
    requireRole(c, ADMIN_GESTOR_ROLES);
    const parsed = InviteCreateSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const body = parsed.data;
    if (!canAssignRole(auth.user.role, body.role)) {
      throw new HTTPException(403, { message: "Você não tem permissão para convidar esse perfil" });
    }
    const admin = createAdminClient();
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", body.email.toLowerCase())
      .maybeSingle();
    if (existingProfile) throw new HTTPException(409, { message: "Já existe um usuário com esse e-mail" });

    await admin.from("invites").update({ status: "cancelado" }).eq("email", body.email.toLowerCase()).eq("status", "pendente");

    const userClient = createUserClient(auth.token);
    const { data: invite, error } = await userClient
      .from("invites")
      .insert({
        email: body.email.toLowerCase(),
        role: body.role,
        invited_by: auth.user.id,
        turma_ids: body.role === "professor" ? body.turma_ids : [],
      })
      .select("id, token, expires_at")
      .single();
    if (error || !invite) {
      if (error) throw dbError(error);
      throw new HTTPException(500, { message: "Falha ao criar convite" });
    }

    const acceptUrl = inviteAcceptUrl(c.req.header("origin") ?? "http://localhost:8080", invite.token);
    const { error: mailError } = await admin.auth.admin.inviteUserByEmail(body.email.toLowerCase(), {
      redirectTo: acceptUrl,
      data: { invite_token: invite.token, role: body.role },
    });

    await admin.from("audit_log").insert({
      user_id: auth.user.id,
      user_email: auth.user.email,
      acao: "INVITE_CREATE",
      entidade: "invites",
      registro_id: invite.id,
      dados_depois: {
        email: body.email.toLowerCase(),
        role: body.role,
        expires_at: invite.expires_at,
        email_sent: !mailError,
        email_error: mailError?.message ?? null,
        at: new Date().toISOString(),
      },
    });

    return c.json({
      ok: true,
      invite_id: invite.id,
      accept_url: acceptUrl,
      expires_at: invite.expires_at,
      email_sent: !mailError,
      email_error: mailError?.message,
    });
  });

  router.post("/:id/resend", async (c) => {
    const auth = getAuth(c);
    requireRole(c, ADMIN_GESTOR_ROLES);
    const inviteId = c.req.param("id");
    const parsed = InviteResendSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw new HTTPException(400, { message: "Payload inválido" });

    const admin = createAdminClient();
    const { data: existing, error } = await admin
      .from("invites")
      .select("id, email, role, token, status, invited_by")
      .eq("id", inviteId)
      .maybeSingle();
    if (error || !existing) throw new HTTPException(404, { message: "Convite não encontrado" });
    if (auth.user.role === "gestor" && existing.invited_by !== auth.user.id) {
      throw new HTTPException(404, { message: "Convite não encontrado" });
    }
    if (!canAssignRole(auth.user.role, existing.role as UserRole)) {
      throw new HTTPException(403, { message: "Você não tem permissão para reenviar esse convite" });
    }
    if (!["pendente", "expirado"].includes(existing.status)) {
      throw new HTTPException(400, { message: "Apenas convites pendentes ou expirados podem ser reenviados" });
    }

    const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: updateError } = await admin
      .from("invites")
      .update({ status: "pendente", expires_at: newExpires })
      .eq("id", existing.id);
    if (updateError) throw dbError(updateError);

    const acceptUrl = inviteAcceptUrl(c.req.header("origin") ?? "http://localhost:8080", existing.token);
    const { error: mailError } = await admin.auth.admin.inviteUserByEmail(existing.email, {
      redirectTo: acceptUrl,
      data: { invite_token: existing.token, role: existing.role },
    });

    await admin.from("audit_log").insert({
      user_id: auth.user.id,
      user_email: auth.user.email,
      acao: "INVITE_RESEND",
      entidade: "invites",
      registro_id: existing.id,
      dados_depois: {
        email: existing.email,
        role: existing.role,
        expires_at: newExpires,
        email_sent: !mailError,
        email_error: mailError?.message ?? null,
        at: new Date().toISOString(),
      },
    });

    return c.json({
      ok: true,
      invite_id: existing.id,
      accept_url: acceptUrl,
      expires_at: newExpires,
      email_sent: !mailError,
      email_error: mailError?.message,
      resent: true,
    });
  });

  router.patch("/:id/cancel", async (c) => {
    const auth = getAuth(c);
    requireRole(c, ADMIN_GESTOR_ROLES);
    const inviteId = c.req.param("id");
    const admin = createAdminClient();
    const { data: invite, error: fetchError } = await admin
      .from("invites")
      .select("id, invited_by")
      .eq("id", inviteId)
      .maybeSingle();
    if (fetchError || !invite) throw new HTTPException(404, { message: "Convite não encontrado" });
    if (auth.user.role === "gestor" && invite.invited_by !== auth.user.id) {
      throw new HTTPException(404, { message: "Convite não encontrado" });
    }
    const { error } = await admin.from("invites").update({ status: "cancelado" }).eq("id", inviteId);
    if (error) throw dbError(error);
    return c.json({ ok: true });
  });

  router.get("/by-token/:token", async (c) => {
    const token = c.req.param("token");
    if (!z.uuid().safeParse(token).success) {
      throw new HTTPException(404, { message: "Convite não encontrado" });
    }
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("get_invite_by_token", { _token: token });
    if (error) throw dbError(error);
    if (!data || data.length === 0) throw new HTTPException(404, { message: "Convite não encontrado" });
    return c.json({ invite: data[0] });
  });

  router.post("/accept", async (c) => {
    const parsed = AcceptInviteSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? "Payload inválido" });
    }
    const { token, name, password } = parsed.data;
    const admin = createAdminClient();
    const { data: invite, error: inviteError } = await admin
      .from("invites")
      .select("id, email, role, status, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (inviteError || !invite) throw new HTTPException(404, { message: "Convite não encontrado" });
    if (invite.status !== "pendente") throw new HTTPException(410, { message: "Convite já foi utilizado ou cancelado" });
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      await admin.from("invites").update({ status: "expirado" }).eq("id", invite.id);
      throw new HTTPException(410, { message: "Convite expirado" });
    }

    const { data: list, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw dbError(usersError);
    const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === invite.email.toLowerCase());

    let userId = existing?.id;
    if (existing) {
      const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata ?? {}), name, role: invite.role },
      });
      if (updErr) throw new HTTPException(400, { message: updErr.message });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { name, role: invite.role },
      });
      if (createErr || !created.user) throw new HTTPException(400, { message: createErr?.message ?? "Falha ao criar usuário" });
      userId = created.user.id;
    }

    // Toda a transação (lock do convite + atribuição de role + vínculo de turmas
    // + marcar como aceito) acontece atomicamente dentro da função SQL
    // public.accept_invite, executada com SECURITY DEFINER. Isso elimina a
    // necessidade de uma conexão pg direta no backend.
    const { data: rpcResult, error: rpcError } = await admin.rpc("accept_invite", {
      _token: token,
      _user_id: userId,
    });
    if (rpcError) throw dbError(rpcError, 400);
    const result = rpcResult as { ok: boolean; error?: string } | null;
    if (!result?.ok) {
      const message = result?.error ?? "Falha ao aceitar convite";
      const status = message.toLowerCase().includes("já possui") ? 409 : 410;
      throw new HTTPException(status, { message });
    }

    return c.json({ ok: true, email: invite.email, role: invite.role });
  });

  router.post("/test", async (c) => {
    const auth = getAuth(c);
    requireRole(c, ADMIN_ONLY);
    const parsed = TestInviteSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new HTTPException(400, { message: "Payload inválido" });
    const admin = createAdminClient();
    const now = new Date();
    const email = `teste-${parsed.data.scenario}-${Date.now()}@nexus.local`;
    const baseInsert: Record<string, unknown> = {
      email,
      role: "professor",
      invited_by: auth.user.id,
      turma_ids: [],
      is_test: true,
    };
    if (parsed.data.scenario === "expirado") baseInsert.expires_at = new Date(now.getTime() - 3600_000).toISOString();
    if (parsed.data.scenario === "cancelado") baseInsert.status = "cancelado";
    if (parsed.data.scenario === "aceito") {
      baseInsert.status = "aceito";
      baseInsert.accepted_at = now.toISOString();
      baseInsert.accepted_by = auth.user.id;
    }
    const { data, error } = await admin.from("invites").insert(baseInsert).select("token").single();
    if (error || !data) {
      if (error) throw dbError(error);
      throw new HTTPException(500, { message: "Falha ao criar convite de teste" });
    }
    return c.json({
      ok: true,
      accept_url: inviteAcceptUrl(c.req.header("origin") ?? "http://localhost:8080", data.token),
    });
  });

  router.delete("/test", async (c) => {
    requireRole(c, ADMIN_ONLY);
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("delete_test_invites");
    if (error) throw dbError(error);
    return c.json({ ok: true, deleted: data ?? 0 });
  });

  return router;
}