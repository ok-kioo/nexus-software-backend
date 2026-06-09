CREATE TABLE public.capelo_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX capelo_messages_user_created_idx ON public.capelo_messages (user_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.capelo_messages TO authenticated;
GRANT ALL ON public.capelo_messages TO service_role;

ALTER TABLE public.capelo_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own capelo messages"
  ON public.capelo_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own capelo messages"
  ON public.capelo_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own capelo messages"
  ON public.capelo_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);