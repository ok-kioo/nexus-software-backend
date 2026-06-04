-- ============================================================
-- DEV ONLY: Seed do administrador padrão (admin@nexus.com / admin123)
-- Não rodar em produção. Idempotente.
-- ============================================================

DO $$
DECLARE
  v_user_id uuid;
  v_email   text := 'admin@nexus.com';
  v_password text := 'admin123';
BEGIN
  -- 1) Cria usuário em auth.users se não existir
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', 'Admin Dev'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      extensions.gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(), now(), now()
    );
  END IF;

  -- 2) Garante perfil
  INSERT INTO public.profiles (id, name, email)
  VALUES (v_user_id, 'Admin Dev', v_email)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;

  -- 3) Garante role administrador (remove default 'professor' se houver)
  DELETE FROM public.user_roles WHERE user_id = v_user_id AND role = 'professor';
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'administrador'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;