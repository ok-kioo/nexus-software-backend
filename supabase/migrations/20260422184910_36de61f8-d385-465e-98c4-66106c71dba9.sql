-- Add is_test flag to invites for QA scenarios
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Cleanup function: only administrators can delete test invites
CREATE OR REPLACE FUNCTION public.delete_test_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'forbidden: only administrators can delete test invites';
  END IF;
  WITH deleted AS (
    DELETE FROM public.invites WHERE is_test = true RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM deleted;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_test_invites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_test_invites() TO authenticated;