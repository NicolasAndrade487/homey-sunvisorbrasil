INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) IN ('admin@sunvisorbrasil.com.br', 'admin@sunvisorbrasil.com')
ON CONFLICT (user_id, role) DO NOTHING;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;

CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles FOR UPDATE TO authenticated
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::public.app_role
  )
  OR lower(COALESCE(auth.jwt() ->> 'email', '')) IN (
    'admin@sunvisorbrasil.com.br',
    'admin@sunvisorbrasil.com'
  )
)
WITH CHECK (
  auth.uid() = id
  OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::public.app_role
  )
  OR lower(COALESCE(auth.jwt() ->> 'email', '')) IN (
    'admin@sunvisorbrasil.com.br',
    'admin@sunvisorbrasil.com'
  )
);