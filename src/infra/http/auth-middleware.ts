import { HTTPException } from "hono/http-exception";
import type { Context, Next } from "hono";
import { z } from "zod";
import { createAdminClient, createUserClient } from "../database/supabase-client";
import type { AppUser, AuthContextValue } from "../shared/types";
import { USER_ROLES, derivePrimaryRole, type UserRole } from "../shared/roles";
import { dbError } from "../shared/db-errors";

export const RoleSchema = z.enum(USER_ROLES);

export async function resolveAppUser(token: string): Promise<AppUser> {
  const userClient = createUserClient(token);
  const admin = createAdminClient();

  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    throw new HTTPException(401, { message: "Sessão inválida" });
  }

  const userId = claimsData.claims.sub;
  const userEmail = String(claimsData.claims.email ?? "");

  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
    admin.from("profiles").select("id, name, email").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (profileError) throw dbError(profileError);
  if (rolesError) throw dbError(rolesError);

  const mappedRoles = (roles ?? []).map((item) => item.role as UserRole);
  const role = derivePrimaryRole(mappedRoles);

  return {
    id: userId,
    email: profile?.email ?? userEmail,
    name: profile?.name ?? userEmail.split("@")[0] ?? "Usuário",
    roles: mappedRoles,
    role,
  };
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Não autenticado" });
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) throw new HTTPException(401, { message: "Token ausente" });

  const user = await resolveAppUser(token);
  c.set("auth", { token, user } satisfies AuthContextValue);

  await next();
}

export function getAuth(c: Context): AuthContextValue {
  const auth = c.get("auth") as AuthContextValue | undefined;
  if (!auth) throw new HTTPException(401, { message: "Não autenticado" });
  return auth;
}

/**
 * Cria um cliente Supabase com o JWT do usuário autenticado.
 * Use sempre que a operação deva ser filtrada/protegida pelas políticas RLS
 * (ex.: leituras de turmas/notas/frequência por professor).
 */
export function userClient(c: Context) {
  const { token } = getAuth(c);
  return createUserClient(token);
}

export function requireRole(c: Context, allowed: UserRole[]) {
  const { user } = getAuth(c);
  if (!allowed.includes(user.role)) {
    throw new HTTPException(403, { message: "Sem permissão para esta ação" });
  }
  return user;
}