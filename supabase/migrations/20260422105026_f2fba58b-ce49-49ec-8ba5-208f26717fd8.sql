-- Fix privilege escalation: ensure direct user_roles inserts only target self.
-- Bulk/role-on-behalf assignment must go through accept_invite (service_role only).

DROP POLICY IF EXISTS "Hierarquia: inserir papéis" ON public.user_roles;

CREATE POLICY "Hierarquia: inserir papéis"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_assign_role(auth.uid(), role)
);

-- Same for delete: only allow removing own role rows via the policy path.
-- Admins still manage other users' roles via the accept_invite flow / service role.
DROP POLICY IF EXISTS "Hierarquia: remover papéis" ON public.user_roles;

CREATE POLICY "Hierarquia: remover papéis"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND public.can_assign_role(auth.uid(), role)
);