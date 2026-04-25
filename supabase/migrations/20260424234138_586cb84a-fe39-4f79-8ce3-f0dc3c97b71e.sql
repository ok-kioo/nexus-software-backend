-- ============================================================
-- Módulo de Alertas: tabelas, RLS, índices e auditoria
-- ============================================================

CREATE TABLE public.alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,                          -- 'risco-aluno' | 'freq-turma' | 'ocup-turma' | ...
  severity text NOT NULL,                      -- 'critico' | 'atencao' | 'informativo'
  entidade text NOT NULL,                      -- 'aluno' | 'turma' | 'rede'
  entidade_id uuid,                            -- id de aluno/turma; null para alertas de rede
  titulo text NOT NULL,
  descricao text NOT NULL,
  unidade text,                                -- nome amigável da unidade
  unidade_id uuid,                             -- referência à unidade quando aplicável
  metricas jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ativo',        -- 'ativo' | 'resolvido' | 'ignorado' | 'convertido'
  plano_id uuid,                               -- preenchido quando promovido a plano de ação
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alertas_severity_chk CHECK (severity IN ('critico','atencao','informativo')),
  CONSTRAINT alertas_status_chk   CHECK (status   IN ('ativo','resolvido','ignorado','convertido'))
);

-- Unicidade lógica de "alerta ativo" por (tipo, entidade_id) — permite múltiplos registros ao longo do tempo.
CREATE UNIQUE INDEX alertas_unq_ativo
  ON public.alertas (tipo, COALESCE(entidade_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'ativo';

CREATE INDEX alertas_status_idx       ON public.alertas (status);
CREATE INDEX alertas_entidade_idx     ON public.alertas (entidade, entidade_id);
CREATE INDEX alertas_last_seen_idx    ON public.alertas (last_seen_at DESC);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/gestor veem tudo
CREATE POLICY "alertas_select_admin_gestor"
  ON public.alertas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'gestor'));

-- SELECT: professor só vê alertas de suas turmas/alunos
CREATE POLICY "alertas_select_professor"
  ON public.alertas FOR SELECT TO authenticated
  USING (
    (entidade = 'turma' AND entidade_id IS NOT NULL
      AND public.is_professor_of_turma(auth.uid(), entidade_id))
    OR (entidade = 'aluno' AND entidade_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.matriculas m
        WHERE m.aluno_id = entidade_id
          AND public.is_professor_of_turma(auth.uid(), m.turma_id)
      ))
  );

-- INSERT/UPDATE: admin + gestor
CREATE POLICY "alertas_insert_admin_gestor"
  ON public.alertas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "alertas_update_admin_gestor"
  ON public.alertas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'gestor'));

-- DELETE: admin
CREATE POLICY "alertas_delete_admin"
  ON public.alertas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

CREATE TRIGGER alertas_set_updated_at
  BEFORE UPDATE ON public.alertas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER alertas_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.alertas
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================================
-- Histórico do alerta
-- ============================================================
CREATE TABLE public.alerta_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id uuid NOT NULL REFERENCES public.alertas(id) ON DELETE CASCADE,
  evento text NOT NULL,        -- 'detected' | 'reseen' | 'status_change' | 'promoted'
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX alerta_historico_alerta_idx ON public.alerta_historico (alerta_id, created_at DESC);

ALTER TABLE public.alerta_historico ENABLE ROW LEVEL SECURITY;

-- Mesma visibilidade do alerta pai
CREATE POLICY "hist_select_admin_gestor"
  ON public.alerta_historico FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "hist_select_professor"
  ON public.alerta_historico FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.alertas a
    WHERE a.id = alerta_historico.alerta_id
      AND (
        (a.entidade = 'turma' AND a.entidade_id IS NOT NULL
          AND public.is_professor_of_turma(auth.uid(), a.entidade_id))
        OR (a.entidade = 'aluno' AND a.entidade_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.matriculas m
            WHERE m.aluno_id = a.entidade_id
              AND public.is_professor_of_turma(auth.uid(), m.turma_id)
          ))
      )
  ));

CREATE POLICY "hist_insert_admin_gestor"
  ON public.alerta_historico FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'gestor'));