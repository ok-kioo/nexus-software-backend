-- 1. Helper para promover (ou rebaixar para admin) qualquer usuário pelo e-mail.
--    Útil para corrigir contas seed que ficaram sem role.
CREATE OR REPLACE FUNCTION public.promote_to_admin(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não encontrado para o e-mail informado');
  END IF;

  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'administrador');

  RETURN jsonb_build_object('ok', true, 'user_id', v_user_id, 'role', 'administrador');
END;
$$;

-- Restringe execução: apenas service_role pode chamar essa função.
REVOKE ALL ON FUNCTION public.promote_to_admin(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_to_admin(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_admin(text) TO service_role;

-- 2. Habilita realtime para import_jobs (mensageria substituindo polling).
ALTER TABLE public.import_jobs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'import_jobs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.import_jobs';
  END IF;
END $$;