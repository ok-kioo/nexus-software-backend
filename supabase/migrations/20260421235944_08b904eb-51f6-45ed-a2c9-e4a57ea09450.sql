-- Função: pode o usuário atual atribuir/remover este papel?
CREATE OR REPLACE FUNCTION public.can_assign_role(_assigner uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- admin pode tudo
    public.has_role(_assigner, 'administrador')
    OR
    -- gestor só pode atribuir/remover professor
    (public.has_role(_assigner, 'gestor') AND _role = 'professor');
$$;

-- Substituir políticas de INSERT/DELETE em user_roles
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Hierarquia: inserir papéis" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.can_assign_role(auth.uid(), role));

CREATE POLICY "Hierarquia: remover papéis" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.can_assign_role(auth.uid(), role));

-- Gestor também precisa enxergar todos os papéis para conseguir gerenciar
CREATE POLICY "Gestor vê todos papéis" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));