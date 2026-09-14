CREATE OR REPLACE FUNCTION public.guard_profile_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.aprovado IS DISTINCT FROM OLD.aprovado
      OR NEW.decidido_em IS DISTINCT FROM OLD.decidido_em
      OR NEW.decidido_por IS DISTINCT FROM OLD.decidido_por
    )
    AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'SEM_PERMISSAO_PARA_ALTERAR_ACESSO';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_profile_status() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS profiles_guard_status ON public.profiles;
CREATE TRIGGER profiles_guard_status
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_status();
