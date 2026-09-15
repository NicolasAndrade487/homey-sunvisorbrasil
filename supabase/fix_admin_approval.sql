INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) IN ('admin@sunvisorbrasil.com.br', 'admin@sunvisorbrasil.com')
ON CONFLICT (user_id, role) DO NOTHING;

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