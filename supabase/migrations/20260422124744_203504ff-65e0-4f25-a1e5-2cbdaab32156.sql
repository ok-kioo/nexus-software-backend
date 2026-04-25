-- Helper: adicionar FK de forma idempotente
DO $$
BEGIN
  -- planos_acao
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planos_acao_aluno_id_fkey') THEN
    ALTER TABLE public.planos_acao
      ADD CONSTRAINT planos_acao_aluno_id_fkey
      FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planos_acao_responsavel_id_fkey') THEN
    ALTER TABLE public.planos_acao
      ADD CONSTRAINT planos_acao_responsavel_id_fkey
      FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planos_acao_criado_por_fkey') THEN
    ALTER TABLE public.planos_acao
      ADD CONSTRAINT planos_acao_criado_por_fkey
      FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- eventos_calendario
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eventos_calendario_unidade_id_fkey') THEN
    ALTER TABLE public.eventos_calendario
      ADD CONSTRAINT eventos_calendario_unidade_id_fkey
      FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eventos_calendario_criado_por_fkey') THEN
    ALTER TABLE public.eventos_calendario
      ADD CONSTRAINT eventos_calendario_criado_por_fkey
      FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- avisos
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'avisos_autor_id_fkey') THEN
    ALTER TABLE public.avisos
      ADD CONSTRAINT avisos_autor_id_fkey
      FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- avisos_leituras
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'avisos_leituras_aviso_id_fkey') THEN
    ALTER TABLE public.avisos_leituras
      ADD CONSTRAINT avisos_leituras_aviso_id_fkey
      FOREIGN KEY (aviso_id) REFERENCES public.avisos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'avisos_leituras_user_id_fkey') THEN
    ALTER TABLE public.avisos_leituras
      ADD CONSTRAINT avisos_leituras_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- contatos_aluno
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contatos_aluno_aluno_id_fkey') THEN
    ALTER TABLE public.contatos_aluno
      ADD CONSTRAINT contatos_aluno_aluno_id_fkey
      FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contatos_aluno_autor_id_fkey') THEN
    ALTER TABLE public.contatos_aluno
      ADD CONSTRAINT contatos_aluno_autor_id_fkey
      FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- matriculas
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matriculas_aluno_id_fkey') THEN
    ALTER TABLE public.matriculas
      ADD CONSTRAINT matriculas_aluno_id_fkey
      FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matriculas_turma_id_fkey') THEN
    ALTER TABLE public.matriculas
      ADD CONSTRAINT matriculas_turma_id_fkey
      FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;
  END IF;

  -- turmas
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turmas_curso_id_fkey') THEN
    ALTER TABLE public.turmas
      ADD CONSTRAINT turmas_curso_id_fkey
      FOREIGN KEY (curso_id) REFERENCES public.cursos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turmas_unidade_id_fkey') THEN
    ALTER TABLE public.turmas
      ADD CONSTRAINT turmas_unidade_id_fkey
      FOREIGN KEY (unidade_id) REFERENCES public.unidades(id);
  END IF;

  -- notas
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notas_matricula_id_fkey') THEN
    ALTER TABLE public.notas
      ADD CONSTRAINT notas_matricula_id_fkey
      FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE CASCADE;
  END IF;

  -- frequencia
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'frequencia_matricula_id_fkey') THEN
    ALTER TABLE public.frequencia
      ADD CONSTRAINT frequencia_matricula_id_fkey
      FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) ON DELETE CASCADE;
  END IF;

  -- turma_professores
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turma_professores_turma_id_fkey') THEN
    ALTER TABLE public.turma_professores
      ADD CONSTRAINT turma_professores_turma_id_fkey
      FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turma_professores_professor_id_fkey') THEN
    ALTER TABLE public.turma_professores
      ADD CONSTRAINT turma_professores_professor_id_fkey
      FOREIGN KEY (professor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_planos_acao_aluno_id ON public.planos_acao(aluno_id);
CREATE INDEX IF NOT EXISTS idx_planos_acao_status ON public.planos_acao(status);
CREATE INDEX IF NOT EXISTS idx_planos_acao_created_at ON public.planos_acao(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_calendario_data_inicio ON public.eventos_calendario(data_inicio);
CREATE INDEX IF NOT EXISTS idx_eventos_calendario_unidade_id ON public.eventos_calendario(unidade_id);
CREATE INDEX IF NOT EXISTS idx_avisos_created_at ON public.avisos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_avisos_leituras_user_id ON public.avisos_leituras(user_id);
CREATE INDEX IF NOT EXISTS idx_contatos_aluno_aluno_id ON public.contatos_aluno(aluno_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_aluno_id ON public.matriculas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_turma_id ON public.matriculas(turma_id);
CREATE INDEX IF NOT EXISTS idx_notas_matricula_id ON public.notas(matricula_id);
CREATE INDEX IF NOT EXISTS idx_frequencia_matricula_data ON public.frequencia(matricula_id, data DESC);