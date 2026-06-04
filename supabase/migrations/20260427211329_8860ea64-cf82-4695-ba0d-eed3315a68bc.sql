-- ============================================================
-- 1) GRANTS NATIVOS reforçados para o papel "authenticated"
-- RLS continua ativa; apenas garante que os privilégios SQL
-- nativos existam para que as policies possam ser aplicadas.
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'unidades','cursos','turmas','turma_professores','alunos','matriculas',
    'frequencia','notas','alertas','alerta_historico','planos_acao',
    'avisos','avisos_leituras','eventos_calendario','contatos_aluno',
    'import_jobs','profiles','user_roles','audit_log','invites'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
  END LOOP;
END $$;

-- ============================================================
-- Permissões adicionais de schema e service_role
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Reforço específico para import_jobs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO service_role;

-- Sequências (caso futuras tabelas usem identity/serial)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO authenticated;

-- ============================================================
-- 2) Hardening de SECURITY DEFINER expostas
-- promote_to_admin e delete_test_invites são internas; remove
-- execução de anon/authenticated. accept_invite/get_invite_by_token
-- precisam continuar acessíveis para o fluxo público de convite.
-- ============================================================
REVOKE ALL ON FUNCTION public.promote_to_admin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_admin(text) TO service_role;

REVOKE ALL ON FUNCTION public.delete_test_invites() FROM PUBLIC, anon;
-- mantém para authenticated; a própria função verifica has_role('administrador')

-- ============================================================
-- 3) Função utilitária: a base ainda precisa de primeira importação?
-- Considera-se "primeira importação concluída" quando existe ao menos
-- 1 registro em CADA uma das 7 entidades estruturais.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_initial_import_required()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT (
    EXISTS (SELECT 1 FROM public.unidades) AND
    EXISTS (SELECT 1 FROM public.cursos) AND
    EXISTS (SELECT 1 FROM public.turmas) AND
    EXISTS (SELECT 1 FROM public.alunos) AND
    EXISTS (SELECT 1 FROM public.matriculas) AND
    EXISTS (SELECT 1 FROM public.frequencia) AND
    EXISTS (SELECT 1 FROM public.notas)
  );
$$;

REVOKE ALL ON FUNCTION public.is_initial_import_required() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_initial_import_required() TO authenticated, service_role;
