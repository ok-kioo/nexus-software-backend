-- Hardening da tabela capelo_messages: mensagens são imutáveis para usuários finais.
-- Revoga UPDATE de authenticated/anon; não cria política de UPDATE; service_role mantém ALL.

ALTER TABLE public.capelo_messages ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE ON public.capelo_messages FROM authenticated;
REVOKE UPDATE ON public.capelo_messages FROM anon;
REVOKE ALL ON public.capelo_messages FROM anon;

-- Garante que service_role tenha todos os privilégios (usado pelo backend Node).
GRANT ALL ON public.capelo_messages TO service_role;