-- 1) SELECT em cursos para professores (cursos das turmas em que ensinam)
CREATE POLICY "cursos_select_professor"
ON public.cursos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.curso_id = cursos.id
      AND public.is_professor_of_turma(auth.uid(), t.id)
  )
);

-- 2) SELECT em unidades para professores (unidades das turmas em que ensinam)
CREATE POLICY "unidades_select_professor"
ON public.unidades
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.unidade_id = unidades.id
      AND public.is_professor_of_turma(auth.uid(), t.id)
  )
);

-- 3) Realtime de avisos: incluir professores (alinha com avisos_select_all)
DROP POLICY IF EXISTS "avisos_realtime_admin_gestor" ON realtime.messages;

CREATE POLICY "avisos_realtime_authenticated"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'professor'::public.app_role)
);

-- Observação: realtime.messages é compartilhada por todos os canais; a policy acima
-- permite que o cliente abra a subscription, mas o conteúdo entregue continua filtrado
-- pelas RLS das tabelas de origem (avisos / planos_acao), garantindo que cada usuário
-- só receba os payloads que já poderia ler via SELECT direto.
