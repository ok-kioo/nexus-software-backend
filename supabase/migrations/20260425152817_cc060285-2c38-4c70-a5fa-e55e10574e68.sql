-- Enum de status do job de importação
CREATE TYPE public.import_job_status AS ENUM (
  'queued',
  'parsing',
  'validating',
  'persisting',
  'completed',
  'failed',
  'cancelled'
);

-- Tabela de jobs de importação
CREATE TABLE public.import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  status public.import_job_status NOT NULL DEFAULT 'queued',
  progress_pct INT NOT NULL DEFAULT 0,
  current_step TEXT,
  total_rows INT,
  processed_rows INT NOT NULL DEFAULT 0,
  total_chunks INT,
  processed_chunks INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  validation_errors JSONB,
  result_summary JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_jobs_user_id ON public.import_jobs(user_id);
CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX idx_import_jobs_created_at ON public.import_jobs(created_at DESC);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- Usuário vê os próprios jobs; admin vê todos
CREATE POLICY "import_jobs_select_own_or_admin"
  ON public.import_jobs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));

-- Insert: somente admin/gestor podem criar (são os papéis com permissão de importar)
CREATE POLICY "import_jobs_insert_admin_gestor"
  ON public.import_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'gestor'))
  );

-- Update: dono pode atualizar (cancelar) o próprio job; admin pode tudo
CREATE POLICY "import_jobs_update_own_or_admin"
  ON public.import_jobs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));

-- Delete: somente admin
CREATE POLICY "import_jobs_delete_admin"
  ON public.import_jobs
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

-- Trigger updated_at
CREATE TRIGGER set_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.import_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_jobs;

-- Bucket privado para uploads de planilhas
INSERT INTO storage.buckets (id, name, public)
VALUES ('import-uploads', 'import-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: usuário só acessa pasta com seu próprio user_id
CREATE POLICY "import_uploads_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'import-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "import_uploads_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'import-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'gestor'))
  );

CREATE POLICY "import_uploads_delete_own_or_admin"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'import-uploads'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'administrador')
    )
  );