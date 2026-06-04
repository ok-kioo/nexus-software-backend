DROP POLICY IF EXISTS "avisos_realtime_authenticated" ON realtime.messages;

-- Permite subscription apenas no tópico "avisos" e apenas para usuários autenticados com role válido.
-- O conteúdo entregue pelos eventos postgres_changes continua filtrado pela RLS da tabela avisos
-- (que já respeita publico_alvo).
CREATE POLICY "avisos_realtime_topic_scoped"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'avisos'
  AND (
    public.has_role(auth.uid(), 'administrador'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'professor'::public.app_role)
  )
);
