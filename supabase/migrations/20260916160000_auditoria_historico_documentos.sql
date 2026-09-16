CREATE TABLE IF NOT EXISTS public.documentos_versoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID NOT NULL,
  versao INTEGER NOT NULL,
  dados JSONB NOT NULL,
  criado_por UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (documento_id, versao)
);

CREATE TABLE IF NOT EXISTS public.documentos_auditoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID,
  usuario_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  acao TEXT NOT NULL CHECK (acao IN ('criado', 'atualizado', 'excluido')),
  detalhes JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documentos_versoes_documento_idx
  ON public.documentos_versoes (documento_id, versao DESC);
CREATE INDEX IF NOT EXISTS documentos_auditoria_documento_idx
  ON public.documentos_auditoria (documento_id, criado_em DESC);

ALTER TABLE public.documentos_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_auditoria ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.documentos_versoes TO authenticated;
GRANT SELECT ON public.documentos_auditoria TO authenticated;

DROP POLICY IF EXISTS "versoes_select_leitura" ON public.documentos_versoes;
CREATE POLICY "versoes_select_leitura"
ON public.documentos_versoes FOR SELECT TO authenticated
USING (public.usuario_tem_permissao('ler'));

DROP POLICY IF EXISTS "auditoria_select_admin" ON public.documentos_auditoria;
CREATE POLICY "auditoria_select_admin"
ON public.documentos_auditoria FOR SELECT TO authenticated
USING (public.usuario_admin());

CREATE OR REPLACE FUNCTION public.registrar_auditoria_documento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.documentos_auditoria (documento_id, usuario_id, acao, detalhes)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    CASE TG_OP WHEN 'INSERT' THEN 'criado' WHEN 'UPDATE' THEN 'atualizado' ELSE 'excluido' END,
    jsonb_build_object(
      'titulo', COALESCE(NEW.titulo, OLD.titulo),
      'categoria', COALESCE(NEW.categoria, OLD.categoria),
      'tipo', COALESCE(NEW.tipo, OLD.tipo)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_versao_documento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proxima_versao INTEGER;
BEGIN
  SELECT COALESCE(MAX(versao), 0) + 1 INTO proxima_versao
  FROM public.documentos_versoes WHERE documento_id = OLD.id;

  INSERT INTO public.documentos_versoes (documento_id, versao, dados, criado_por)
  VALUES (OLD.id, proxima_versao, to_jsonb(OLD), auth.uid());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restaurar_versao_documento(_versao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  versao_anterior public.documentos_versoes%ROWTYPE;
BEGIN
  IF NOT public.usuario_admin() THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA';
  END IF;

  SELECT * INTO versao_anterior
  FROM public.documentos_versoes
  WHERE id = _versao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERSAO_NAO_ENCONTRADA';
  END IF;

  UPDATE public.documentos
  SET titulo = COALESCE(versao_anterior.dados->>'titulo', titulo),
      categoria = COALESCE(versao_anterior.dados->>'categoria', categoria),
      descricao = versao_anterior.dados->>'descricao',
      tipo = COALESCE(versao_anterior.dados->>'tipo', tipo),
      url = versao_anterior.dados->>'url',
      storage_path = versao_anterior.dados->>'storage_path',
      file_name = versao_anterior.dados->>'file_name',
      file_size = NULLIF(versao_anterior.dados->>'file_size', '')::bigint,
      codigo_produto = versao_anterior.dados->>'codigo_produto',
      versao = versao_anterior.dados->>'versao',
      data_vigencia = NULLIF(versao_anterior.dados->>'data_vigencia', '')::date
  WHERE id = versao_anterior.documento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCUMENTO_NAO_ENCONTRADO';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restaurar_versao_documento(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurar_versao_documento(uuid) TO authenticated;

DROP TRIGGER IF EXISTS documentos_auditoria_trigger ON public.documentos;
CREATE TRIGGER documentos_auditoria_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_documento();

DROP TRIGGER IF EXISTS documentos_versao_trigger ON public.documentos;
CREATE TRIGGER documentos_versao_trigger
BEFORE UPDATE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.guardar_versao_documento();
