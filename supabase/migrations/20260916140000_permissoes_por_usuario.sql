ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo_usuario text NOT NULL DEFAULT 'membro',
  ADD COLUMN IF NOT EXISTS pode_ler boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_atualizar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_excluir boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET tipo_usuario = 'admin', pode_ler = true, pode_atualizar = true, pode_excluir = true
WHERE id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
)
OR lower(email) IN ('admin@sunvisorbrasil.com.br', 'admin@sunvisorbrasil.com');

CREATE OR REPLACE FUNCTION public.usuario_tem_permissao(_permissao text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.usuario_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND aprovado = true
        AND status = 'aprovado'
        AND CASE _permissao
          WHEN 'ler' THEN pode_ler
          WHEN 'atualizar' THEN pode_atualizar
          WHEN 'excluir' THEN pode_excluir
          ELSE false
        END
    );
$$;

CREATE OR REPLACE FUNCTION public.definir_permissoes_usuario(
  _usuario_id uuid,
  _tipo_usuario text,
  _pode_ler boolean,
  _pode_atualizar boolean,
  _pode_excluir boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_admin() THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA';
  END IF;

  IF _tipo_usuario NOT IN ('admin', 'membro') THEN
    RAISE EXCEPTION 'TIPO_USUARIO_INVALIDO';
  END IF;

  UPDATE public.profiles
  SET tipo_usuario = _tipo_usuario,
      pode_ler = _pode_ler,
      pode_atualizar = _pode_atualizar,
      pode_excluir = _pode_excluir
  WHERE id = _usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USUARIO_NAO_ENCONTRADO';
  END IF;

  IF _tipo_usuario = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_usuario_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _usuario_id AND role = 'admin';
  END IF;
END;
$$;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
ON public.profiles FOR UPDATE TO authenticated
USING (public.usuario_admin())
WITH CHECK (public.usuario_admin());

REVOKE EXECUTE ON FUNCTION public.definir_permissoes_usuario(uuid, text, boolean, boolean, boolean)
FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_permissoes_usuario(uuid, text, boolean, boolean, boolean)
TO authenticated;

DROP POLICY IF EXISTS "documentos_select_authenticated" ON public.documentos;
DROP POLICY IF EXISTS "documentos_select_com_permissao" ON public.documentos;
CREATE POLICY "documentos_select_com_permissao"
ON public.documentos FOR SELECT TO authenticated
USING (public.usuario_tem_permissao('ler'));

DROP POLICY IF EXISTS "documentos_insert_aprovado" ON public.documentos;
DROP POLICY IF EXISTS "documentos_insert_com_permissao" ON public.documentos;
CREATE POLICY "documentos_insert_com_permissao"
ON public.documentos FOR INSERT TO authenticated
WITH CHECK (public.usuario_tem_permissao('atualizar') AND auth.uid() = created_by);

DROP POLICY IF EXISTS "documentos_update_aprovado" ON public.documentos;
DROP POLICY IF EXISTS "documentos_update_com_permissao" ON public.documentos;
CREATE POLICY "documentos_update_com_permissao"
ON public.documentos FOR UPDATE TO authenticated
USING (public.usuario_tem_permissao('atualizar'))
WITH CHECK (public.usuario_tem_permissao('atualizar'));

DROP POLICY IF EXISTS "documentos_delete_admin" ON public.documentos;
DROP POLICY IF EXISTS "documentos_delete_com_permissao" ON public.documentos;
CREATE POLICY "documentos_delete_com_permissao"
ON public.documentos FOR DELETE TO authenticated
USING (public.usuario_tem_permissao('excluir'));

DROP POLICY IF EXISTS "documentos_files_select" ON storage.objects;
DROP POLICY IF EXISTS "documentos_files_select_com_permissao" ON storage.objects;
CREATE POLICY "documentos_files_select_com_permissao"
ON storage.objects FOR SELECT TO authenticated
USING (public.usuario_tem_permissao('ler') AND bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_files_insert_aprovado" ON storage.objects;
DROP POLICY IF EXISTS "documentos_files_insert_com_permissao" ON storage.objects;
CREATE POLICY "documentos_files_insert_com_permissao"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (public.usuario_tem_permissao('atualizar') AND bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_files_update_aprovado" ON storage.objects;
DROP POLICY IF EXISTS "documentos_files_update_com_permissao" ON storage.objects;
CREATE POLICY "documentos_files_update_com_permissao"
ON storage.objects FOR UPDATE TO authenticated
USING (public.usuario_tem_permissao('atualizar') AND bucket_id = 'documentos')
WITH CHECK (public.usuario_tem_permissao('atualizar') AND bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_files_delete_admin" ON storage.objects;
DROP POLICY IF EXISTS "documentos_files_delete_com_permissao" ON storage.objects;
CREATE POLICY "documentos_files_delete_com_permissao"
ON storage.objects FOR DELETE TO authenticated
USING (public.usuario_tem_permissao('excluir') AND bucket_id = 'documentos');
