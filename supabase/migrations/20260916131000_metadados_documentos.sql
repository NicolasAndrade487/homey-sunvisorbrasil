ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS codigo_produto TEXT,
  ADD COLUMN IF NOT EXISTS versao TEXT,
  ADD COLUMN IF NOT EXISTS data_vigencia DATE;

CREATE INDEX IF NOT EXISTS documentos_codigo_produto_idx
  ON public.documentos (codigo_produto);
