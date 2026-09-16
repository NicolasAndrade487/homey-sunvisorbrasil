CREATE TABLE IF NOT EXISTS public.documentos_favoritos (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  documento_id UUID NOT NULL REFERENCES public.documentos (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, documento_id)
);

CREATE TABLE IF NOT EXISTS public.documentos_recentes (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  documento_id UUID NOT NULL REFERENCES public.documentos (id) ON DELETE CASCADE,
  acessado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, documento_id)
);

CREATE INDEX IF NOT EXISTS documentos_recentes_usuario_data_idx
  ON public.documentos_recentes (user_id, acessado_em DESC);

ALTER TABLE public.documentos_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_recentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favoritos_select_own" ON public.documentos_favoritos;
CREATE POLICY "favoritos_select_own"
ON public.documentos_favoritos FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favoritos_insert_own" ON public.documentos_favoritos;
CREATE POLICY "favoritos_insert_own"
ON public.documentos_favoritos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favoritos_delete_own" ON public.documentos_favoritos;
CREATE POLICY "favoritos_delete_own"
ON public.documentos_favoritos FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "recentes_select_own" ON public.documentos_recentes;
CREATE POLICY "recentes_select_own"
ON public.documentos_recentes FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "recentes_insert_own" ON public.documentos_recentes;
CREATE POLICY "recentes_insert_own"
ON public.documentos_recentes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "recentes_update_own" ON public.documentos_recentes;
CREATE POLICY "recentes_update_own"
ON public.documentos_recentes FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
