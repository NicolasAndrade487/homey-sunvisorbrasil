export const CATEGORIAS = [
  "Manual de Instalação",
  "Ficha Técnica",
  "Catálogo",
  "Certificado",
  "Garantia",
  "Outro",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export type Documento = {
  id: string;
  titulo: string;
  categoria: string;
  codigo_produto: string | null;
  descricao: string | null;
  data_vigencia: string | null;
  tipo: string;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  file_size: number | null;
  versao: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function formatarData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function formatarTamanho(bytes: number | null) {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
