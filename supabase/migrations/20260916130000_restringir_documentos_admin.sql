CREATE OR REPLACE FUNCTION public.usuario_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR lower(COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), '')) IN (
      'admin@sunvisorbrasil.com.br',
      'admin@sunvisorbrasil.com'
    );
$$;

DROP POLICY IF EXISTS "documentos_insert_authenticated" ON public.documentos;
CREATE POLICY "documentos_insert_admin"
ON public.documentos FOR INSERT TO authenticated
WITH CHECK (public.usuario_admin() AND auth.uid() = created_by);

DROP POLICY IF EXISTS "documentos_update_authenticated" ON public.documentos;
CREATE POLICY "documentos_update_admin"
ON public.documentos FOR UPDATE TO authenticated
USING (public.usuario_admin())
WITH CHECK (public.usuario_admin());

DROP POLICY IF EXISTS "documentos_delete_authenticated" ON public.documentos;
CREATE POLICY "documentos_delete_admin"
ON public.documentos FOR DELETE TO authenticated
USING (public.usuario_admin());

DROP POLICY IF EXISTS "documentos_files_insert" ON storage.objects;
CREATE POLICY "documentos_files_insert_admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (public.usuario_admin() AND bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_files_update" ON storage.objects;
CREATE POLICY "documentos_files_update_admin"
ON storage.objects FOR UPDATE TO authenticated
USING (public.usuario_admin() AND bucket_id = 'documentos')
WITH CHECK (public.usuario_admin() AND bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_files_delete" ON storage.objects;
CREATE POLICY "documentos_files_delete_admin"
ON storage.objects FOR DELETE TO authenticated
USING (public.usuario_admin() AND bucket_id = 'documentos');
