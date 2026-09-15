DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles FOR UPDATE TO authenticated
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);