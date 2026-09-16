CREATE OR REPLACE FUNCTION public.usuario_aprovado()
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
        AND (aprovado = true OR status = 'aprovado')
    );
$$;

DROP POLICY IF EXISTS "documentos_insert_admin" ON public.documentos;
CREATE POLICY "documentos_insert_aprovado"
ON public.documentos FOR INSERT TO authenticated
WITH CHECK (public.usuario_aprovado() AND auth.uid() = created_by);

DROP POLICY IF EXISTS "documentos_update_admin" ON public.documentos;
CREATE POLICY "documentos_update_aprovado"
ON public.documentos FOR UPDATE TO authenticated
USING (public.usuario_aprovado())
WITH CHECK (public.usuario_aprovado());

DROP POLICY IF EXISTS "documentos_files_insert_admin" ON storage.objects;
CREATE POLICY "documentos_files_insert_aprovado"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (public.usuario_aprovado() AND bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_files_update_admin" ON storage.objects;
CREATE POLICY "documentos_files_update_aprovado"
ON storage.objects FOR UPDATE TO authenticated
USING (public.usuario_aprovado() AND bucket_id = 'documentos')
WITH CHECK (public.usuario_aprovado() AND bucket_id = 'documentos');
