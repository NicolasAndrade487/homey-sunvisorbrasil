CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz,
  ADD COLUMN IF NOT EXISTS decidido_por uuid;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(split_part(COALESCE(NEW.email, ''), '@', 2)) NOT IN ('sunvisorbrasil.com.br', 'sunvisorbrasil.com') THEN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outro',
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'link',
  url TEXT,
  storage_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_select_authenticated" ON public.documentos;
CREATE POLICY "documentos_select_authenticated"
ON public.documentos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "documentos_insert_authenticated" ON public.documentos;
CREATE POLICY "documentos_insert_authenticated"
ON public.documentos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "documentos_update_authenticated" ON public.documentos;
CREATE POLICY "documentos_update_authenticated"
ON public.documentos FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "documentos_delete_authenticated" ON public.documentos;
CREATE POLICY "documentos_delete_authenticated"
ON public.documentos FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS documentos_categoria_idx ON public.documentos (categoria);
CREATE INDEX IF NOT EXISTS documentos_created_at_idx ON public.documentos (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documentos_set_updated_at ON public.documentos;
CREATE TRIGGER documentos_set_updated_at
BEFORE UPDATE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "documentos_files_select" ON storage.objects;
CREATE POLICY "documentos_files_select"
ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_files_insert" ON storage.objects;
CREATE POLICY "documentos_files_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_files_update" ON storage.objects;
CREATE POLICY "documentos_files_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_files_delete" ON storage.objects;
CREATE POLICY "documentos_files_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos');