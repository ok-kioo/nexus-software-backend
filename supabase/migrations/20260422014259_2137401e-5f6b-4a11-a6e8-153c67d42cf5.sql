
-- ============ 1. CONTATOS ALUNO ============
CREATE TABLE public.contatos_aluno (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL,
  autor_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'anotacao',
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contatos_aluno ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contatos_select_admin_gestor" ON public.contatos_aluno FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "contatos_select_professor" ON public.contatos_aluno FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM matriculas m WHERE m.aluno_id = contatos_aluno.aluno_id AND is_professor_of_turma(auth.uid(), m.turma_id)));

CREATE POLICY "contatos_insert_admin_gestor" ON public.contatos_aluno FOR INSERT TO authenticated
WITH CHECK ((has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor')) AND autor_id = auth.uid());

CREATE POLICY "contatos_insert_professor" ON public.contatos_aluno FOR INSERT TO authenticated
WITH CHECK (autor_id = auth.uid() AND EXISTS (SELECT 1 FROM matriculas m WHERE m.aluno_id = contatos_aluno.aluno_id AND is_professor_of_turma(auth.uid(), m.turma_id)));

CREATE POLICY "contatos_update_own" ON public.contatos_aluno FOR UPDATE TO authenticated
USING (autor_id = auth.uid() OR has_role(auth.uid(), 'administrador'));

CREATE POLICY "contatos_delete_admin" ON public.contatos_aluno FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'administrador') OR autor_id = auth.uid());

CREATE TRIGGER contatos_aluno_updated BEFORE UPDATE ON public.contatos_aluno
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2. AVISOS / MURAL ============
CREATE TABLE public.avisos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  corpo TEXT NOT NULL,
  publico_alvo TEXT NOT NULL DEFAULT 'todos', -- todos | professores | gestores
  autor_id UUID NOT NULL,
  fixado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avisos_select_all" ON public.avisos FOR SELECT TO authenticated
USING (
  publico_alvo = 'todos'
  OR (publico_alvo = 'professores' AND has_role(auth.uid(), 'professor'))
  OR (publico_alvo = 'gestores' AND (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'administrador')))
  OR has_role(auth.uid(), 'administrador')
);

CREATE POLICY "avisos_insert_admin_gestor" ON public.avisos FOR INSERT TO authenticated
WITH CHECK ((has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor')) AND autor_id = auth.uid());

CREATE POLICY "avisos_update_admin_gestor" ON public.avisos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'administrador') OR (has_role(auth.uid(), 'gestor') AND autor_id = auth.uid()));

CREATE POLICY "avisos_delete_admin_gestor" ON public.avisos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'administrador') OR (has_role(auth.uid(), 'gestor') AND autor_id = auth.uid()));

CREATE TRIGGER avisos_updated BEFORE UPDATE ON public.avisos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.avisos_leituras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aviso_id UUID NOT NULL REFERENCES public.avisos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  lido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, user_id)
);
ALTER TABLE public.avisos_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leituras_select_own" ON public.avisos_leituras FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'administrador'));

CREATE POLICY "leituras_insert_own" ON public.avisos_leituras FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "leituras_delete_own" ON public.avisos_leituras FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.avisos;

-- ============ 3. EVENTOS CALENDÁRIO ============
CREATE TABLE public.eventos_calendario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'evento', -- evento | prova | feriado | reuniao | inicio_semestre | fim_semestre
  data_inicio DATE NOT NULL,
  data_fim DATE,
  unidade_id UUID,
  criado_por UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.eventos_calendario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos_select_all" ON public.eventos_calendario FOR SELECT TO authenticated USING (true);

CREATE POLICY "eventos_insert_admin_gestor" ON public.eventos_calendario FOR INSERT TO authenticated
WITH CHECK ((has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor')) AND criado_por = auth.uid());

CREATE POLICY "eventos_update_admin_gestor" ON public.eventos_calendario FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "eventos_delete_admin_gestor" ON public.eventos_calendario FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));

CREATE TRIGGER eventos_updated BEFORE UPDATE ON public.eventos_calendario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 5. PLANOS DE AÇÃO ============
CREATE TABLE public.planos_acao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  responsavel_id UUID,
  prazo DATE,
  status TEXT NOT NULL DEFAULT 'aberto', -- aberto | andamento | concluido | cancelado
  prioridade TEXT NOT NULL DEFAULT 'media', -- baixa | media | alta
  origem_alerta TEXT,
  criado_por UUID NOT NULL,
  concluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.planos_acao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planos_select_admin_gestor" ON public.planos_acao FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "planos_select_professor" ON public.planos_acao FOR SELECT TO authenticated
USING (
  responsavel_id = auth.uid()
  OR EXISTS (SELECT 1 FROM matriculas m WHERE m.aluno_id = planos_acao.aluno_id AND is_professor_of_turma(auth.uid(), m.turma_id))
);

CREATE POLICY "planos_insert_admin_gestor" ON public.planos_acao FOR INSERT TO authenticated
WITH CHECK ((has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor')) AND criado_por = auth.uid());

CREATE POLICY "planos_update_admin_gestor_resp" ON public.planos_acao FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'administrador')
  OR has_role(auth.uid(), 'gestor')
  OR responsavel_id = auth.uid()
);

CREATE POLICY "planos_delete_admin" ON public.planos_acao FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'administrador'));

CREATE TRIGGER planos_updated BEFORE UPDATE ON public.planos_acao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.planos_acao;

-- ============ 6. AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  acao TEXT NOT NULL, -- INSERT | UPDATE | DELETE
  entidade TEXT NOT NULL,
  registro_id UUID,
  dados_antes JSONB,
  dados_depois JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_admin" ON public.audit_log FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'administrador'));

CREATE INDEX idx_audit_entidade ON public.audit_log(entidade, created_at DESC);
CREATE INDEX idx_audit_user ON public.audit_log(user_id, created_at DESC);

-- Função de auditoria genérica
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, user_email, acao, entidade, registro_id, dados_depois)
    VALUES (auth.uid(), v_user_email, TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, user_email, acao, entidade, registro_id, dados_antes, dados_depois)
    VALUES (auth.uid(), v_user_email, TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, user_email, acao, entidade, registro_id, dados_antes)
    VALUES (auth.uid(), v_user_email, TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_alunos AFTER INSERT OR UPDATE OR DELETE ON public.alunos
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_matriculas AFTER INSERT OR UPDATE OR DELETE ON public.matriculas
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_notas AFTER INSERT OR UPDATE OR DELETE ON public.notas
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_frequencia AFTER INSERT OR UPDATE OR DELETE ON public.frequencia
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
