-- 1) Harden handle_new_user: never trust role from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  -- Always default to professor. Elevation only via accept_invite (service role).
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'professor');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

-- 2) Lock down accept_invite: revoke from anon/authenticated, only service_role may call.
REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid, uuid) TO service_role;

-- 3) Add internal guard: only allow accept_invite when user has no roles other than the default 'professor'
CREATE OR REPLACE FUNCTION public.accept_invite(_token uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.invites%ROWTYPE;
  v_turma_id UUID;
  v_existing_count INT;
  v_non_default_count INT;
BEGIN
  -- Safety: do not allow hijacking accounts that already have elevated roles.
  SELECT COUNT(*) INTO v_existing_count FROM public.user_roles WHERE user_id = _user_id;
  SELECT COUNT(*) INTO v_non_default_count
    FROM public.user_roles
    WHERE user_id = _user_id AND role <> 'professor';

  IF v_non_default_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário já possui papel atribuído');
  END IF;

  -- Also reject if the user already has more than the single default professor role.
  IF v_existing_count > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário já possui papel atribuído');
  END IF;

  SELECT * INTO v_invite
  FROM public.invites
  WHERE token = _token
    AND status = 'pendente'
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Convite inválido ou expirado');
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, v_invite.role);

  IF v_invite.role = 'professor' AND array_length(v_invite.turma_ids, 1) > 0 THEN
    FOREACH v_turma_id IN ARRAY v_invite.turma_ids LOOP
      INSERT INTO public.turma_professores (professor_id, turma_id)
      VALUES (_user_id, v_turma_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.invites
  SET status = 'aceito',
      accepted_at = now(),
      accepted_by = _user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'role', v_invite.role, 'email', v_invite.email);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid, uuid) TO service_role;

-- 4) Allow gestores to view profiles (needed for user management UI)
CREATE POLICY "Gestores can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'gestor'));
