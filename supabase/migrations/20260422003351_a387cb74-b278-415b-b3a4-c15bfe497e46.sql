-- Tabela de convites
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  turma_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceito','expirado','cancelado')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_token ON public.invites(token);
CREATE INDEX idx_invites_email ON public.invites(lower(email));
CREATE INDEX idx_invites_invited_by ON public.invites(invited_by);
CREATE INDEX idx_invites_status ON public.invites(status);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE TRIGGER update_invites_updated_at
BEFORE UPDATE ON public.invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Políticas RLS
-- SELECT: admin vê todos; gestor vê os que ele criou
CREATE POLICY "invites_select_admin"
ON public.invites FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "invites_select_gestor_own"
ON public.invites FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'gestor') AND invited_by = auth.uid());

-- INSERT: usa hierarquia (admin pode tudo, gestor só professor)
CREATE POLICY "invites_insert_hierarchy"
ON public.invites FOR INSERT
TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND public.can_assign_role(auth.uid(), role)
);

-- UPDATE: admin tudo; gestor só os próprios e ainda pendentes
CREATE POLICY "invites_update_admin"
ON public.invites FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "invites_update_gestor_own"
ON public.invites FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'gestor') AND invited_by = auth.uid());

-- DELETE: admin tudo; gestor só os próprios
CREATE POLICY "invites_delete_admin"
ON public.invites FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "invites_delete_gestor_own"
ON public.invites FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'gestor') AND invited_by = auth.uid());

-- Função para aceitar convite (executada por edge function via service role)
-- Recebe o token e o user_id recém-criado; valida e aplica role + turmas
CREATE OR REPLACE FUNCTION public.accept_invite(_token UUID, _user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.invites%ROWTYPE;
  v_turma_id UUID;
BEGIN
  -- Busca convite pendente e válido
  SELECT * INTO v_invite
  FROM public.invites
  WHERE token = _token
    AND status = 'pendente'
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Convite inválido ou expirado');
  END IF;

  -- Remove qualquer role 'professor' default que possa ter sido criada pelo trigger
  -- e atribui o role correto do convite
  DELETE FROM public.user_roles WHERE user_id = _user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, v_invite.role);

  -- Vincula turmas (apenas se for professor)
  IF v_invite.role = 'professor' AND array_length(v_invite.turma_ids, 1) > 0 THEN
    FOREACH v_turma_id IN ARRAY v_invite.turma_ids LOOP
      INSERT INTO public.turma_professores (professor_id, turma_id)
      VALUES (_user_id, v_turma_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Marca convite como aceito
  UPDATE public.invites
  SET status = 'aceito',
      accepted_at = now(),
      accepted_by = _user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'role', v_invite.role, 'email', v_invite.email);
END;
$$;

-- Função pública para olhar dados básicos do convite pelo token (usada na tela de aceite)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token UUID)
RETURNS TABLE(email TEXT, role public.app_role, status TEXT, expires_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email, role, status, expires_at
  FROM public.invites
  WHERE token = _token
  LIMIT 1;
$$;

-- Permitir chamadas anônimas para essas duas funções (a tela de aceite é pública)
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(UUID, UUID) TO anon, authenticated;