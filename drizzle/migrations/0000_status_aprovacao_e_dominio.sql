-- 1. Status de aprovacao
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz,
  ADD COLUMN IF NOT EXISTS decidido_por uuid;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET status = 'aprovado'
WHERE aprovado IS TRUE;

-- 2. Sincroniza status <-> aprovado nos dois sentidos
CREATE OR REPLACE FUNCTION public.sync_status_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pendente','aprovado','recusado') THEN
    RAISE EXCEPTION 'status invalido: %', NEW.status;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.aprovado := (NEW.status = 'aprovado');
  ELSIF TG_OP = 'UPDATE' AND NEW.aprovado IS DISTINCT FROM OLD.aprovado THEN
    NEW.status := CASE WHEN NEW.aprovado THEN 'aprovado' ELSE 'pendente' END;
  ELSE
    NEW.aprovado := (NEW.status = 'aprovado');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_status_aprovado() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS profiles_sync_status ON public.profiles;
CREATE TRIGGER profiles_sync_status
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_status_aprovado();

-- 3. is_aprovado exige status aprovado
CREATE OR REPLACE FUNCTION public.is_aprovado(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id AND aprovado AND status = 'aprovado'
  )
$$;

-- 4. Cadastro somente com email @sunvisorbrasil.com (contas ja existentes nao sao afetadas)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(split_part(COALESCE(NEW.email, ''), '@', 2)) <> 'sunvisorbrasil.com' THEN
    RAISE EXCEPTION 'EMAIL_DOMINIO_NAO_AUTORIZADO';
  END IF;

  INSERT INTO public.profiles (id, display_name, email, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'pendente'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
