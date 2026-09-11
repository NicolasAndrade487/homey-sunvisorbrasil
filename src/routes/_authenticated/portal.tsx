import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  BookOpen,
  ExternalLink,
  FileText,
  HelpCircle,
  LogOut,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Table2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CATEGORIAS,
  formatarData,
  formatarTamanho,
  type Documento,
} from "@/lib/documentos";
import { AcessosDialog } from "@/components/acessos-dialog";
import logo from "@/assets/svb-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "Catálogo de documentos · Portal SVB" },
      {
        name: "description",
        content:
          "Catálogo interno da SVB: manuais de instalação, fichas técnicas, catálogos, certificados e garantias.",
      },
      { property: "og:title", content: "Catálogo de documentos · Portal SVB" },
      {
        property: "og:description",
        content: "Consulte e cadastre os documentos técnicos da SVB.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portal,
});

const ICONES: Record<string, typeof FileText> = {
  "Manual de Instalação": FileText,
  "Ficha Técnica": Table2,
  Catálogo: BookOpen,
  Certificado: BadgeCheck,
  Garantia: ShieldCheck,
  Outro: HelpCircle,
};

const LIMITE_BYTES = 50 * 1024 * 1024;

function Portal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("Todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [acessosAberto, setAcessosAberto] = useState(false);
  const [editando, setEditando] = useState<Documento | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Documento | null>(null);

  const { data: acesso, isLoading: carregandoAcesso } = useQuery({
    queryKey: ["meu-acesso"],
    queryFn: async () => {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao.user?.id;
      if (!uid) return { aprovado: false, admin: false, email: null as string | null };
      const [{ data: perfil }, { data: papeis }] = await Promise.all([
        supabase.from("profiles").select("aprovado, email").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      return {
        aprovado: Boolean(perfil?.aprovado),
        admin: Boolean(papeis?.some((p) => p.role === "admin")),
        email: perfil?.email ?? sessao.user?.email ?? null,
      };
    },
  });

  const aprovado = Boolean(acesso?.aprovado);

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ["documentos"],
    enabled: aprovado,
    queryFn: async (): Promise<Documento[]> => {
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Documento[];
    },
  });

  const contagens = useMemo(() => {
    const mapa: Record<string, number> = {};
    documentos.forEach((d) => {
      mapa[d.categoria] = (mapa[d.categoria] ?? 0) + 1;
    });
    return mapa;
  }, [documentos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return documentos.filter((d) => {
      const okCategoria = categoriaAtiva === "Todos" || d.categoria === categoriaAtiva;
      const okBusca =
        !termo ||
        `${d.titulo} ${d.descricao ?? ""} ${d.file_name ?? ""}`.toLowerCase().includes(termo);
      return okCategoria && okBusca;
    });
  }, [documentos, busca, categoriaAtiva]);

  async function abrirDocumento(doc: Documento) {
    if (doc.tipo === "link" && doc.url) {
      window.open(doc.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!doc.storage_path) return;
    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 300);
    if (error || !data) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function excluir(doc: Documento) {
    if (doc.storage_path) {
      await supabase.storage.from("documentos").remove([doc.storage_path]);
    }
    const { error } = await supabase.from("documentos").delete().eq("id", doc.id);
    if (error) {
      toast.error("Não foi possível remover o documento.");
      return;
    }
    toast.success("Documento removido.");
    queryClient.invalidateQueries({ queryKey: ["documentos"] });
  }

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (carregandoAcesso) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Verificando seu acesso...</p>
      </div>
    );
  }

  if (!aprovado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-deep via-brand to-brand px-4 py-12">
        <img src={logo.url} alt="SVB" className="mb-8 h-11 w-auto brightness-0 invert" />
        <div className="w-full max-w-sm rounded-sm border-t-[3px] border-t-gold bg-card p-7 text-center shadow-lg">
          <ShieldCheck className="mx-auto h-8 w-8 text-brand" />
          <h1 className="mt-4 font-display text-xl font-semibold text-card-foreground">
            Acesso aguardando liberação
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta <strong>{acesso?.email}</strong> foi criada, mas ainda não tem permissão para
            ver os documentos. Fale com o responsável do portal para liberar seu acesso.
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={sair}>
            Sair
          </Button>
        </div>
        <p className="mt-6 text-xs text-primary-foreground/50">Acesso restrito · SVB</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-[3px] border-b-gold bg-gradient-to-br from-brand-deep via-brand to-brand">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-5">
          <div className="flex flex-shrink-0 items-center gap-4">
            <img src={logo.url} alt="SVB" className="h-10 w-auto brightness-0 invert" />
            <span className="hidden h-8 w-px bg-primary-foreground/25 sm:block" />
            <div className="hidden font-display text-sm leading-tight text-primary-foreground/70 sm:block">
              <strong className="block text-base font-semibold text-primary-foreground">
                Portal de Documentos
              </strong>
              Manuais e fichas técnicas
            </div>
          </div>

          <div className="ml-auto flex flex-1 items-center gap-2 sm:max-w-md">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-foreground/50" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar documento..."
                className="border-primary-foreground/20 bg-primary-foreground/10 pl-9 text-primary-foreground placeholder:text-primary-foreground/45 focus-visible:border-gold"
              />
            </div>
            <Button
              className="bg-gold font-semibold text-gold-foreground hover:bg-gold/90"
              onClick={() => {
                setEditando(null);
                setModalAberto(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Adicionar</span>
            </Button>
            {acesso?.admin ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAcessosAberto(true)}
                title="Quem pode entrar"
                className="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <ShieldCheck className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={sair}
              title="Sair"
              className="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6">
          {["Todos", ...CATEGORIAS].map((cat) => {
            const ativo = categoriaAtiva === cat;
            const total = cat === "Todos" ? documentos.length : (contagens[cat] ?? 0);
            return (
              <button
                key={cat}
                onClick={() => setCategoriaAtiva(cat)}
                className={`whitespace-nowrap border-b-[3px] px-4 py-3.5 text-sm transition-colors ${
                  ativo
                    ? "border-b-gold font-semibold text-brand"
                    : "border-b-transparent text-muted-foreground hover:text-brand"
                }`}
              >
                {cat}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{total}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold text-brand-deep">
            {categoriaAtiva === "Todos" ? "Todos os documentos" : categoriaAtiva}
          </h1>
          <span className="text-sm text-muted-foreground">
            {filtrados.length} {filtrados.length === 1 ? "documento" : "documentos"}
          </span>
        </div>

        {isLoading ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            Carregando documentos...
          </p>
        ) : filtrados.length === 0 ? (
          <div className="py-20 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <h2 className="mt-4 font-display text-lg font-medium text-brand">
              Nenhum documento encontrado
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {documentos.length === 0
                ? "Ainda não há documentos cadastrados. Adicione o primeiro."
                : "Ajuste a busca ou escolha outra categoria."}
            </p>
            <Button
              className="mt-5 bg-gold font-semibold text-gold-foreground hover:bg-gold/90"
              onClick={() => {
                setEditando(null);
                setModalAberto(true);
              }}
            >
              <Plus className="h-4 w-4" /> Adicionar documento
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((doc) => {
              const Icone = ICONES[doc.categoria] ?? HelpCircle;
              return (
                <article
                  key={doc.id}
                  className="flex flex-col gap-2.5 rounded-sm border border-l-[3px] border-border border-l-brand bg-card p-4 transition-all hover:border-l-gold hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-secondary">
                      <Icone className="h-4 w-4 text-brand" />
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-semibold tracking-wide text-brand">
                      {doc.categoria}
                    </span>
                  </div>
                  <h2 className="font-display text-base font-medium leading-snug text-card-foreground">
                    {doc.titulo}
                  </h2>
                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                    {doc.descricao || "Sem descrição adicional."}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground/80">
                      {formatarData(doc.created_at)}
                      {doc.tipo === "file" && doc.file_size
                        ? ` · ${formatarTamanho(doc.file_size)}`
                        : ""}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        title="Editar"
                        onClick={() => {
                          setEditando(doc);
                          setModalAberto(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Remover"
                        onClick={() => setParaExcluir(doc)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 bg-brand text-xs font-semibold text-primary-foreground hover:bg-brand/90"
                        onClick={() => abrirDocumento(doc)}
                      >
                        Abrir PDF <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <FormularioDocumento
        aberto={modalAberto}
        documento={editando}
        onFechar={() => setModalAberto(false)}
        onSalvo={() => {
          setModalAberto(false);
          queryClient.invalidateQueries({ queryKey: ["documentos"] });
        }}
      />

      <AlertDialog open={Boolean(paraExcluir)} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento sairá do catálogo para toda a empresa. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (paraExcluir) void excluir(paraExcluir);
                setParaExcluir(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FormularioDocumento({
  aberto,
  documento,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  documento: Documento | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [modo, setModo] = useState<"upload" | "link">("upload");
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0]);
  const [descricao, setDescricao] = useState("");
  const [url, setUrl] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const idCarregado = useRef<string | null>(null);

  const chave = documento?.id ?? "novo";
  if (aberto && idCarregado.current !== chave) {
    idCarregado.current = chave;
    setTitulo(documento?.titulo ?? "");
    setCategoria(documento?.categoria ?? CATEGORIAS[0]);
    setDescricao(documento?.descricao ?? "");
    setUrl(documento?.url ?? "");
    setArquivo(null);
    setModo(documento?.tipo === "link" ? "link" : "upload");
  }
  if (!aberto && idCarregado.current !== null) idCarregado.current = null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Informe o título do documento.");
      return;
    }

    setSalvando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const userId = sessao.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");

      let campos: Partial<Documento> = {
        titulo: titulo.trim(),
        categoria,
        descricao: descricao.trim() || null,
      };

      if (modo === "link") {
        try {
          new URL(url);
        } catch {
          throw new Error("Informe um link válido, começando com https://");
        }
        campos = {
          ...campos,
          tipo: "link",
          url,
          storage_path: null,
          file_name: null,
          file_size: null,
        };
      } else if (arquivo) {
        if (arquivo.size > LIMITE_BYTES) {
          throw new Error("O arquivo passa de 50 MB. Use a opção de link.");
        }
        const caminho = `${userId}/${crypto.randomUUID()}-${arquivo.name}`;
        const { error: erroUpload } = await supabase.storage
          .from("documentos")
          .upload(caminho, arquivo, { contentType: arquivo.type || "application/pdf" });
        if (erroUpload) throw new Error("Falha ao enviar o arquivo.");
        campos = {
          ...campos,
          tipo: "file",
          url: null,
          storage_path: caminho,
          file_name: arquivo.name,
          file_size: arquivo.size,
        };
      } else if (!documento || documento.tipo !== "file") {
        throw new Error("Selecione um arquivo PDF ou use a opção de link.");
      }

      if (documento) {
        const { error } = await supabase.from("documentos").update(campos).eq("id", documento.id);
        if (error) throw error;
        toast.success("Documento atualizado.");
      } else {
        const { error } = await supabase
          .from("documentos")
          .insert({ ...campos, titulo: campos.titulo!, created_by: userId });
        if (error) throw error;
        toast.success("Documento salvo no catálogo.");
      }
      onSalvo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-t-[3px] border-t-gold sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {documento ? "Editar documento" : "Adicionar documento"}
          </DialogTitle>
          <DialogDescription>
            Envie o PDF direto ou cole o link de um arquivo já hospedado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-sm bg-secondary p-1">
          {(["upload", "link"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`rounded-sm py-2 text-xs font-semibold transition-colors ${
                modo === m
                  ? "bg-card text-brand shadow-sm"
                  : "text-muted-foreground hover:text-brand"
              }`}
            >
              {m === "upload" ? "Enviar arquivo" : "Colar link"}
            </button>
          ))}
        </div>

        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título do documento</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Manual de instalação — Visor Linha Truck"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger id="categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {modo === "upload" ? (
            <div className="space-y-1.5">
              <Label>Arquivo PDF</Label>
              <input
                ref={inputArquivo}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
              {arquivo ? (
                <div className="flex items-center gap-3 rounded-sm border border-border p-3">
                  <FileText className="h-5 w-5 flex-shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{arquivo.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatarTamanho(arquivo.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setArquivo(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputArquivo.current?.click()}
                  className="w-full rounded-sm border-[1.5px] border-dashed border-border px-4 py-6 text-center transition-colors hover:border-gold hover:bg-gold/5"
                >
                  <UploadCloud className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    Clique para escolher o PDF
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    {documento?.tipo === "file"
                      ? `Atual: ${documento.file_name} — envie outro para substituir`
                      : "Tamanho máximo: 50 MB"}
                  </p>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="url">Link do PDF</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground/70">
                O link deve abrir o PDF diretamente.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Breve nota sobre o conteúdo do documento"
              className="min-h-16"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" className="font-semibold" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar documento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
