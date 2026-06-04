-- ============================================================
-- FASE 2: Schema acadêmico completo
-- ============================================================

-- 1. UNIDADES
CREATE TABLE public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_unidade text NOT NULL UNIQUE,
  cidade text NOT NULL,
  estado text NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_unidades_updated_at BEFORE UPDATE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. CURSOS
CREATE TABLE public.cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_curso text NOT NULL UNIQUE,
  categoria text NOT NULL,
  carga_horaria integer,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_cursos_updated_at BEFORE UPDATE ON public.cursos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. TURMAS
CREATE TABLE public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_turma text NOT NULL,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE RESTRICT,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE RESTRICT,
  capacidade integer NOT NULL DEFAULT 40,
  periodo text,
  turno text,
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome_turma, unidade_id, curso_id)
);
CREATE INDEX idx_turmas_unidade ON public.turmas(unidade_id);
CREATE INDEX idx_turmas_curso ON public.turmas(curso_id);
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_turmas_updated_at BEFORE UPDATE ON public.turmas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. TURMA_PROFESSORES
CREATE TABLE public.turma_professores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  professor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turma_id, professor_id)
);
CREATE INDEX idx_turma_professores_professor ON public.turma_professores(professor_id);
CREATE INDEX idx_turma_professores_turma ON public.turma_professores(turma_id);
ALTER TABLE public.turma_professores ENABLE ROW LEVEL SECURITY;

-- Função auxiliar (depois das tabelas)
CREATE OR REPLACE FUNCTION public.is_professor_of_turma(_user_id uuid, _turma_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.turma_professores
    WHERE professor_id = _user_id AND turma_id = _turma_id
  )
$$;

-- 5. ALUNOS
CREATE TABLE public.alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_aluno text NOT NULL,
  documento text NOT NULL UNIQUE,
  data_nascimento date,
  email text,
  telefone text,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alunos_nome ON public.alunos(nome_aluno);
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_alunos_updated_at BEFORE UPDATE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. MATRICULAS
CREATE TABLE public.matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_matricula text NOT NULL UNIQUE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE RESTRICT,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ativa',
  data_inicio date,
  data_fim date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, turma_id)
);
CREATE INDEX idx_matriculas_aluno ON public.matriculas(aluno_id);
CREATE INDEX idx_matriculas_turma ON public.matriculas(turma_id);
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_matriculas_updated_at BEFORE UPDATE ON public.matriculas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. FREQUENCIA
CREATE TABLE public.frequencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  data date NOT NULL,
  presente boolean NOT NULL,
  observacao text,
  registrado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (matricula_id, data)
);
CREATE INDEX idx_frequencia_matricula ON public.frequencia(matricula_id);
CREATE INDEX idx_frequencia_data ON public.frequencia(data);
ALTER TABLE public.frequencia ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_frequencia_updated_at BEFORE UPDATE ON public.frequencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. NOTAS
CREATE TABLE public.notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula_id uuid NOT NULL UNIQUE REFERENCES public.matriculas(id) ON DELETE CASCADE,
  nota_1 numeric(4,2) CHECK (nota_1 IS NULL OR (nota_1 >= 0 AND nota_1 <= 10)),
  nota_2 numeric(4,2) CHECK (nota_2 IS NULL OR (nota_2 >= 0 AND nota_2 <= 10)),
  nota_3 numeric(4,2) CHECK (nota_3 IS NULL OR (nota_3 >= 0 AND nota_3 <= 10)),
  nota_4 numeric(4,2) CHECK (nota_4 IS NULL OR (nota_4 >= 0 AND nota_4 <= 10)),
  observacao text,
  registrado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notas_matricula ON public.notas(matricula_id);
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_notas_updated_at BEFORE UPDATE ON public.notas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================

-- UNIDADES
CREATE POLICY "unidades_select_admin_gestor" ON public.unidades FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "unidades_insert_admin_gestor" ON public.unidades FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "unidades_update_admin_gestor" ON public.unidades FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "unidades_delete_admin" ON public.unidades FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'administrador'));

-- CURSOS
CREATE POLICY "cursos_select_admin_gestor" ON public.cursos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "cursos_insert_admin_gestor" ON public.cursos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "cursos_update_admin_gestor" ON public.cursos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "cursos_delete_admin" ON public.cursos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'administrador'));

-- TURMAS
CREATE POLICY "turmas_select_admin_gestor" ON public.turmas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "turmas_select_professor" ON public.turmas FOR SELECT TO authenticated
  USING (public.is_professor_of_turma(auth.uid(), id));
CREATE POLICY "turmas_insert_admin_gestor" ON public.turmas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "turmas_update_admin_gestor" ON public.turmas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "turmas_delete_admin" ON public.turmas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'administrador'));

-- TURMA_PROFESSORES
CREATE POLICY "tp_select_admin_gestor" ON public.turma_professores FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "tp_select_professor" ON public.turma_professores FOR SELECT TO authenticated
  USING (professor_id = auth.uid());
CREATE POLICY "tp_insert_admin_gestor" ON public.turma_professores FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "tp_delete_admin_gestor" ON public.turma_professores FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));

-- ALUNOS
CREATE POLICY "alunos_select_admin_gestor" ON public.alunos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "alunos_select_professor" ON public.alunos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.aluno_id = alunos.id
        AND public.is_professor_of_turma(auth.uid(), m.turma_id)
    )
  );
CREATE POLICY "alunos_insert_admin_gestor" ON public.alunos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "alunos_update_admin_gestor" ON public.alunos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "alunos_delete_admin" ON public.alunos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'administrador'));

-- MATRICULAS
CREATE POLICY "matriculas_select_admin_gestor" ON public.matriculas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "matriculas_select_professor" ON public.matriculas FOR SELECT TO authenticated
  USING (public.is_professor_of_turma(auth.uid(), turma_id));
CREATE POLICY "matriculas_insert_admin_gestor" ON public.matriculas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "matriculas_update_admin_gestor" ON public.matriculas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "matriculas_delete_admin" ON public.matriculas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'administrador'));

-- FREQUENCIA
CREATE POLICY "freq_select_admin_gestor" ON public.frequencia FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "freq_select_professor" ON public.frequencia FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.id = frequencia.matricula_id
        AND public.is_professor_of_turma(auth.uid(), m.turma_id)
    )
  );
CREATE POLICY "freq_insert_admin_gestor" ON public.frequencia FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "freq_insert_professor" ON public.frequencia FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.id = frequencia.matricula_id
        AND public.is_professor_of_turma(auth.uid(), m.turma_id)
    )
  );
CREATE POLICY "freq_update_admin_gestor" ON public.frequencia FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "freq_update_professor" ON public.frequencia FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.id = frequencia.matricula_id
        AND public.is_professor_of_turma(auth.uid(), m.turma_id)
    )
  );
CREATE POLICY "freq_delete_admin" ON public.frequencia FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'administrador'));

-- NOTAS
CREATE POLICY "notas_select_admin_gestor" ON public.notas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "notas_select_professor" ON public.notas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.id = notas.matricula_id
        AND public.is_professor_of_turma(auth.uid(), m.turma_id)
    )
  );
CREATE POLICY "notas_insert_admin_gestor" ON public.notas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "notas_insert_professor" ON public.notas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.id = notas.matricula_id
        AND public.is_professor_of_turma(auth.uid(), m.turma_id)
    )
  );
CREATE POLICY "notas_update_admin_gestor" ON public.notas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'administrador') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "notas_update_professor" ON public.notas FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      WHERE m.id = notas.matricula_id
        AND public.is_professor_of_turma(auth.uid(), m.turma_id)
    )
  );
CREATE POLICY "notas_delete_admin" ON public.notas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'administrador'));