-- 1) Remove planos_acao do realtime — nenhum hook do app usa subscription para essa tabela
ALTER PUBLICATION supabase_realtime DROP TABLE public.planos_acao;

-- 2) Permite que professor leia perfis de colegas que lecionam em turmas em comum
-- (necessário para resolver responsavel_id em planos de ação sem expor perfis irrestritos)
CREATE POLICY "Professores veem perfis de colegas das mesmas turmas"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.turma_professores tp_self
    JOIN public.turma_professores tp_other
      ON tp_other.turma_id = tp_self.turma_id
    WHERE tp_self.professor_id = auth.uid()
      AND tp_other.professor_id = profiles.id
  )
);
