-- 1) Remover policies que permitem privilege escalation via user_roles
DROP POLICY IF EXISTS "Hierarquia: inserir papéis" ON public.user_roles;
DROP POLICY IF EXISTS "Hierarquia: remover papéis" ON public.user_roles;

-- A criação do papel padrão "professor" acontece via trigger handle_new_user (SECURITY DEFINER).
-- A promoção para gestor/administrador acontece apenas via accept_invite (SECURITY DEFINER).
-- Nenhum cliente autenticado deve poder inserir/atualizar/deletar diretamente em user_roles.

-- Bloqueio explícito (defense-in-depth) — nega qualquer INSERT/UPDATE/DELETE direto
CREATE POLICY "Bloqueia INSERT direto em user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Bloqueia UPDATE direto em user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Bloqueia DELETE direto em user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);

-- 2) Restringir assinatura do canal Realtime de avisos
-- Habilita RLS na tabela realtime.messages (caso ainda não esteja)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Remove policies anteriores (se existirem) para recriar com escopo correto
DROP POLICY IF EXISTS "avisos_realtime_admin_gestor" ON realtime.messages;

-- Permite SELECT (leitura via broadcast/postgres_changes) apenas para admin e gestor
CREATE POLICY "avisos_realtime_admin_gestor"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
);
