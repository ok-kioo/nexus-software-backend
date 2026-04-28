
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS selected_entities text[];

-- Unique indexes used as ON CONFLICT targets for upsert-with-ignore.
CREATE UNIQUE INDEX IF NOT EXISTS unidades_nome_unidade_uniq
  ON public.unidades (nome_unidade);

CREATE UNIQUE INDEX IF NOT EXISTS cursos_nome_curso_uniq
  ON public.cursos (nome_curso);

CREATE UNIQUE INDEX IF NOT EXISTS turmas_nome_unidade_curso_uniq
  ON public.turmas (nome_turma, unidade_id, curso_id);

CREATE UNIQUE INDEX IF NOT EXISTS alunos_documento_uniq
  ON public.alunos (documento);

CREATE UNIQUE INDEX IF NOT EXISTS matriculas_numero_uniq
  ON public.matriculas (numero_matricula);

CREATE UNIQUE INDEX IF NOT EXISTS frequencia_matricula_data_uniq
  ON public.frequencia (matricula_id, data);

CREATE UNIQUE INDEX IF NOT EXISTS notas_matricula_uniq
  ON public.notas (matricula_id);
