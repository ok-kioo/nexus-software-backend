import { HTTPException } from "hono/http-exception";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../../../infra/database/supabase-client";

/**
 * Verifica a senha atual fazendo um signIn isolado (cliente sem persistência),
 * e — só se ok — atualiza para a nova senha via service role.
 */
export async function changeOwnPasswordCase(
  userId: string,
  email: string,
  currentPassword: string,
  newPassword: string,
) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    throw new HTTPException(500, { message: "Configuração de autenticação ausente" });
  }
  const probe = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: signErr } = await probe.auth.signInWithPassword({ email, password: currentPassword });
  if (signErr) {
    throw new HTTPException(401, { message: "Senha atual incorreta" });
  }
  // Encerra a sessão criada pelo probe para não vazar tokens.
  await probe.auth.signOut().catch(() => {});

  const admin = createAdminClient();
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (updErr) throw new HTTPException(400, { message: updErr.message });
  return { ok: true };
}
