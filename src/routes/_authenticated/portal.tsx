import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  BookOpen,
  ArrowDownAZ,
  Clock3,
  Download,
  FileText,
  History,
  HelpCircle,
  LayoutGrid,
  List,
  LogOut,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Table2,
  Trash2,
  UploadCloud,
  X,
  Eye,
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
const ADMIN_EMAILS = ["admin@sunvisorbrasil.com.br", "admin@sunvisorbrasil.com"] as const;

function Portal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("Todos");
  const [ordenacao, setOrdenacao] = useState<"recente" | "alfabetica">("recente");
  const [visualizacao, setVisualizacao] = useState<"grade" | "lista">("grade");
  const [filtroRapido, setFiltroRapido] = useState<"todos" | "favoritos" | "recentes">("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [importacaoAberta, setImportacaoAberta] = useState(false);
  
  const [editando, setEditando] = useState<Documento | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Documento | null>(null);
  const [documentoPreview, setDocumentoPreview] = useState<Documento | null>(null);
  const [urlPreview, setUrlPreview] = useState<string | null>(null);
  const [documentoHistorico, setDocumentoHistorico] = useState<Documento | null>(null);
  const [versaoParaRestaurar, setVersaoParaRestaurar] = useState<string | null>(null);

  const { data: acesso, isLoading: carregandoAcesso } = useQuery({
    queryKey: ["meu-acesso"],
    queryFn: async () => {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao.user?.id;
      const email = sessao.user?.email ?? null;
      if (!uid)
        return {
          aprovado: false,
          status: "pendente",
          admin: false,
          podeLer: false,
          podeAtualizar: false,
          podeExcluir: false,
          id: null,
          email: email ?? null,
        };
      const [{ data: perfil }, { data: papeis, error: erroPapeis }] = await Promise.all([
        supabase
          .from("profiles")
          .select("aprovado, status, email, pode_ler, pode_atualizar, pode_excluir")
          .eq("id", uid)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      const emailNormalizado = (perfil?.email ?? email ?? "").toLowerCase();
      const admin =
        (!erroPapeis && Boolean(papeis?.some((p) => p.role === "admin"))) ||
        ADMIN_EMAILS.includes(emailNormalizado as (typeof ADMIN_EMAILS)[number]);
      const status = perfil?.status ?? (admin ? "aprovado" : "pendente");
      const aprovado = Boolean(perfil?.aprovado || status === "aprovado" || admin);
      const podeLer = admin || Boolean(perfil?.pode_ler);
      const podeAtualizar = admin || Boolean(perfil?.pode_atualizar);
      const podeExcluir = admin || Boolean(perfil?.pode_excluir);

      return {
        aprovado,
        status,
        admin,
        podeLer,
        podeAtualizar,
        podeExcluir,
        id: uid,
        email: perfil?.email ?? email ?? null,
      };
    },
  });

  const aprovado = Boolean(acesso?.aprovado);

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ["documentos"],
    enabled: aprovado && Boolean(acesso?.podeLer),
    queryFn: async (): Promise<Documento[]> => {
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Documento[];
    },
  });

  const usuarioId = acesso?.id;
  const { data: favoritos = [] } = useQuery({
    queryKey: ["documentos-favoritos", usuarioId],
    enabled: Boolean(usuarioId && acesso?.podeLer),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos_favoritos")
        .select("documento_id");
      if (error) throw error;
      return data.map((item) => item.documento_id);
    },
  });

  const { data: recentes = [] } = useQuery({
    queryKey: ["documentos-recentes", usuarioId],
    enabled: Boolean(usuarioId && acesso?.podeLer),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos_recentes")
        .select("documento_id")
        .order("acessado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data.map((item) => item.documento_id);
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
    const resultado = documentos.filter((d) => {
      const okCategoria = categoriaAtiva === "Todos" || d.categoria === categoriaAtiva;
      const okFiltroRapido =
        filtroRapido === "todos" ||
        (filtroRapido === "favoritos" && favoritos.includes(d.id)) ||
        (filtroRapido === "recentes" && recentes.includes(d.id));
      const okBusca =
        !termo ||
        `${d.titulo} ${d.descricao ?? ""} ${d.file_name ?? ""} ${d.codigo_produto ?? ""} ${d.versao ?? ""}`
          .toLowerCase()
          .includes(termo);
      return okCategoria && okBusca && okFiltroRapido;
    });
    return resultado.sort((a, b) =>
      ordenacao === "alfabetica"
        ? a.titulo.localeCompare(b.titulo, "pt-BR")
        : b.created_at.localeCompare(a.created_at),
    );
  }, [documentos, busca, categoriaAtiva, ordenacao, filtroRapido, favoritos, recentes]);

  function registrarAcesso(documentoId: string) {
    if (!usuarioId) return;
    void supabase.from("documentos_recentes").upsert(
      { user_id: usuarioId, documento_id: documentoId, acessado_em: new Date().toISOString() },
      { onConflict: "user_id,documento_id" },
    ).then(({ error }) => {
      if (!error) queryClient.invalidateQueries({ queryKey: ["documentos-recentes", usuarioId] });
    });
  }

  async function alternarFavorito(documentoId: string) {
    if (!usuarioId) return;
    const marcado = favoritos.includes(documentoId);
    const resultado = marcado
      ? await supabase
          .from("documentos_favoritos")
          .delete()
          .eq("user_id", usuarioId)
          .eq("documento_id", documentoId)
      : await supabase
          .from("documentos_favoritos")
          .insert({ user_id: usuarioId, documento_id: documentoId });
    if (resultado.error) {
      toast.error(`Não foi possível atualizar o favorito: ${resultado.error.message}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["documentos-favoritos", usuarioId] });
  }

  async function obterUrlDocumento(doc: Documento) {
    if (doc.tipo === "link" && doc.url) {
      return doc.url;
    }
    if (!doc.storage_path) return null;
    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 300);
    if (error || !data) {
      throw new Error("Não foi possível acessar o arquivo.");
    }
    return data.signedUrl;
  }

  async function visualizarDocumento(doc: Documento) {
    try {
      const url = await obterUrlDocumento(doc);
      if (!url) return;
      registrarAcesso(doc.id);
      setUrlPreview(url);
      setDocumentoPreview(doc);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir o arquivo.");
    }
  }

  async function baixarDocumento(doc: Documento) {
    try {
      const url = await obterUrlDocumento(doc);
      if (!url) return;
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.file_name || `${doc.titulo}.pdf`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível baixar o arquivo.");
    }
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

  async function restaurarVersao() {
    if (!versaoParaRestaurar) return;
    const versaoId = versaoParaRestaurar;
    setVersaoParaRestaurar(null);
    const { error } = await supabase.rpc("restaurar_versao_documento", {
      _versao_id: versaoId,
    });
    if (error) {
      toast.error(`Não foi possível restaurar: ${error.message}`);
      return;
    }
    toast.success("Versão restaurada. A versão atual foi preservada no histórico.");
    queryClient.invalidateQueries({ queryKey: ["documentos"] });
    if (documentoHistorico) {
      queryClient.invalidateQueries({ queryKey: ["documento-versoes", documentoHistorico.id] });
    }
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
        <div className="mb-8 font-display text-5xl font-black tracking-[0.18em] text-primary-foreground [text-shadow:2px_2px_0_rgba(255,255,255,0.15),-1px_1px_0_rgba(255,255,255,0.2)]">
          SVB
        </div>
        <div className="w-full max-w-sm rounded-sm border-t-[3px] border-t-gold bg-card p-7 text-center shadow-lg">
          <ShieldCheck className="mx-auto h-8 w-8 text-brand" />
          <h1 className="mt-4 font-display text-xl font-semibold text-card-foreground">
            {acesso?.status === "recusado" ? "Acesso recusado" : "Acesso aguardando liberação"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {acesso?.status === "recusado" ? (
              <>
                O pedido de acesso da conta <strong>{acesso?.email}</strong> foi recusado pelo
                responsável do portal. Se isso foi um engano, fale com ele.
              </>
            ) : (
              <>
                Sua conta <strong>{acesso?.email}</strong> foi criada, mas ainda não tem permissão
                para ver os documentos. Fale com o responsável do portal para liberar seu acesso.
              </>
            )}
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={sair}>
            Sair
          </Button>
        </div>
        <p className="mt-6 text-xs text-primary-foreground/50">Acesso restrito · SVB</p>
      </div>
    );
  }

  if (!acesso?.podeLer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <ShieldCheck className="h-8 w-8 text-brand" />
        <h1 className="font-display text-xl font-semibold">Leitura não autorizada</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sua conta está aprovada, mas ainda não recebeu permissão para consultar os documentos.
        </p>
        <Button variant="outline" onClick={sair}>Sair</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-[3px] border-b-gold bg-gradient-to-br from-brand-deep via-brand to-brand">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-5">
          <div className="flex flex-shrink-0 items-center gap-4">
            <div className="font-display text-4xl font-black tracking-[0.18em] text-primary-foreground [text-shadow:2px_2px_0_rgba(255,255,255,0.15),-1px_1px_0_rgba(255,255,255,0.2)]">
              SVB
            </div>
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
            {acesso?.podeAtualizar ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Importar vários PDFs"
                  className="h-9 w-9 shrink-0 border border-white/30 !bg-white/15 !text-white shadow-sm hover:!bg-gold hover:!text-gold-foreground"
                  onClick={() => setImportacaoAberta(true)}
                >
                  <UploadCloud className="h-4 w-4" />
                </Button>
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
              </>
            ) : null}
            {acesso?.admin ? (
              <Button
                asChild
                variant="ghost"
                size="icon"
                title="Liberação de acessos"
                className="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to="/aprovacoes">
                  <ShieldCheck className="h-4 w-4" />
                </Link>
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

      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-6 py-2">
          {[
            ["todos", "Todos", null],
            ["favoritos", "Favoritos", Star],
            ["recentes", "Recentes", Clock3],
          ].map(([valor, label, Icone]) => (
            <button
              key={valor as string}
              type="button"
              onClick={() => setFiltroRapido(valor as typeof filtroRapido)}
              className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${
                filtroRapido === valor
                  ? "bg-brand text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-brand"
              }`}
            >
              {Icone ? <Icone className="h-3.5 w-3.5" /> : null}
              {label as string}
              {valor === "favoritos" ? ` (${favoritos.length})` : null}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold text-brand-deep">
            {categoriaAtiva === "Todos" ? "Todos os documentos" : categoriaAtiva}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filtrados.length} {filtrados.length === 1 ? "documento" : "documentos"}
            </span>
            <Select value={ordenacao} onValueChange={(valor) => setOrdenacao(valor as typeof ordenacao)}>
              <SelectTrigger className="h-8 w-[145px] text-xs">
                <ArrowDownAZ className="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recente">Mais recentes</SelectItem>
                <SelectItem value="alfabetica">A-Z</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex rounded-sm border border-border p-0.5">
              <Button
                variant={visualizacao === "grade" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                title="Visualização em grade"
                onClick={() => setVisualizacao("grade")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={visualizacao === "lista" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                title="Visualização em lista"
                onClick={() => setVisualizacao("lista")}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
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
            {acesso?.podeAtualizar ? (
              <Button
                className="mt-5 bg-gold font-semibold text-gold-foreground hover:bg-gold/90"
                onClick={() => {
                  setEditando(null);
                  setModalAberto(true);
                }}
              >
                <Plus className="h-4 w-4" /> Adicionar documento
              </Button>
            ) : null}
          </div>
        ) : (
          <div className={visualizacao === "grade" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-2"}>
            {filtrados.map((doc) => {
              const Icone = ICONES[doc.categoria] ?? HelpCircle;
              const desatualizado = Boolean(
                doc.data_vigencia && new Date(`${doc.data_vigencia}T23:59:59`) < new Date(),
              );
              return (
                <article
                  key={doc.id}
                  className={`flex gap-2.5 rounded-sm border border-l-[3px] border-border border-l-brand bg-card p-4 transition-all hover:border-l-gold hover:shadow-md ${visualizacao === "grade" ? "flex-col" : "flex-row items-center"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-secondary">
                      <Icone className="h-4 w-4 text-brand" />
                    </div>
                    <div className="flex flex-wrap items-start justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 ${favoritos.includes(doc.id) ? "text-gold" : "text-muted-foreground"}`}
                        title={favoritos.includes(doc.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                        onClick={() => void alternarFavorito(doc.id)}
                      >
                        <Star className={`h-4 w-4 ${favoritos.includes(doc.id) ? "fill-current" : ""}`} />
                      </Button>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-semibold tracking-wide text-brand">
                        {doc.categoria}
                      </span>
                      {doc.data_vigencia ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
                            desatualizado
                              ? "bg-destructive/10 text-destructive"
                              : "bg-emerald-500/10 text-emerald-700"
                          }`}
                        >
                          {desatualizado ? "Desatualizado" : "Vigente"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 flex-1 font-display text-base font-medium leading-snug text-card-foreground">
                      {doc.titulo}
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1 px-2 text-xs"
                      title="Ver histórico de versões"
                      onClick={() => setDocumentoHistorico(doc)}
                    >
                      <History className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Histórico</span>
                    </Button>
                  </div>
                  {doc.codigo_produto || doc.versao ? (
                    <p className="text-xs font-medium text-brand">
                      {doc.codigo_produto ? `Código: ${doc.codigo_produto}` : ""}
                      {doc.codigo_produto && doc.versao ? " · " : ""}
                      {doc.versao ? `Rev. ${doc.versao}` : ""}
                    </p>
                  ) : null}
                  <p className={`${visualizacao === "grade" ? "flex-1" : "min-w-0 flex-1 truncate"} text-sm leading-relaxed text-muted-foreground`}>
                    {doc.descricao || "Sem descrição adicional."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
                    <span className="shrink-0 text-xs text-muted-foreground/80">
                      {formatarData(doc.created_at)}
                      {doc.tipo === "file" && doc.file_size
                        ? ` · ${formatarTamanho(doc.file_size)}`
                        : ""}
                    </span>
                    <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-1 sm:w-auto">
                      {acesso?.podeAtualizar ? (
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
                      ) : null}
                      {acesso?.podeExcluir ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Remover"
                          onClick={() => setParaExcluir(doc)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        title="Baixar"
                        onClick={() => void baixarDocumento(doc)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 bg-brand text-xs font-semibold text-primary-foreground hover:bg-brand/90"
                        onClick={() => void visualizarDocumento(doc)}
                      >
                        Visualizar <Eye className="h-3 w-3" />
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

      <ImportacaoLote
        aberto={importacaoAberta}
        onFechar={() => setImportacaoAberta(false)}
        onSalvo={() => {
          setImportacaoAberta(false);
          queryClient.invalidateQueries({ queryKey: ["documentos"] });
        }}
      />

      <Dialog
        open={Boolean(documentoPreview)}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setDocumentoPreview(null);
            setUrlPreview(null);
          }
        }}
      >
        <DialogContent className="flex h-[90vh] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-4 pr-12 sm:px-5">
            <div className="min-w-0 max-w-full">
              <DialogTitle className="truncate font-display text-base sm:text-lg">
                {documentoPreview?.titulo}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Visualização do documento técnico selecionado.
              </DialogDescription>
            </div>
          </DialogHeader>
          {urlPreview ? (
            <iframe
              title={documentoPreview?.titulo ?? "Visualização do documento"}
              src={urlPreview}
              className="min-h-0 flex-1 bg-muted"
            />
          ) : null}
          {documentoPreview ? (
            <div className="flex items-center justify-end border-t border-border bg-card px-4 py-3 sm:px-5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void baixarDocumento(documentoPreview)}
              >
                <Download className="h-4 w-4" />
                Baixar PDF
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(documentoHistorico)}
        onOpenChange={(aberto) => !aberto && setDocumentoHistorico(null)}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Histórico de versões</DialogTitle>
            <DialogDescription>
              {documentoHistorico?.titulo}
              {documentoHistorico?.versao ? ` · revisão atual ${documentoHistorico.versao}` : ""}
            </DialogDescription>
          </DialogHeader>
          {documentoHistorico ? (
            <HistoricoDocumento
              documentoId={documentoHistorico.id}
              versaoAtual={documentoHistorico.versao}
              podeRestaurar={Boolean(acesso?.admin)}
              onRestaurar={(versaoId) => {
                setVersaoParaRestaurar(versaoId);
                return Promise.resolve();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(versaoParaRestaurar)}
        onOpenChange={(aberto) => !aberto && setVersaoParaRestaurar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar esta versão?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento voltará aos dados desta versão. A versão atual será preservada no
              histórico e a ação ficará registrada na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void restaurarVersao()}>
              Restaurar versão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  const [codigoProduto, setCodigoProduto] = useState("");
  const [versao, setVersao] = useState("");
  const [dataVigencia, setDataVigencia] = useState("");
  const [descricao, setDescricao] = useState("");
  const [url, setUrl] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const idCarregado = useRef<string | null>(null);

  useEffect(() => {
    if (!aberto) {
      idCarregado.current = null;
      return;
    }

    const chave = documento?.id ?? "novo";
    if (idCarregado.current === chave) return;

    idCarregado.current = chave;
    setTitulo(documento?.titulo ?? "");
    setCategoria(documento?.categoria ?? CATEGORIAS[0]);
    setCodigoProduto(documento?.codigo_produto ?? "");
    setVersao(documento?.versao ?? "");
    setDataVigencia(documento?.data_vigencia ?? "");
    setDescricao(documento?.descricao ?? "");
    setUrl(documento?.url ?? "");
    setArquivo(null);
    setModo(documento?.tipo === "link" ? "link" : "upload");
  }, [aberto, documento]);

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
        codigo_produto: codigoProduto.trim() || null,
        versao: versao.trim() || null,
        data_vigencia: dataVigencia || null,
        descricao: descricao.trim() || null,
      };

      if (modo === "link") {
        try {
          new URL(url);
        } catch {
          throw new Error("Informe um link válido, começando com https://");
        }
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
      const mensagem =
        err instanceof Error ? err.message : "Não foi possível salvar.";
      console.error("Salvar documento falhou:", err);
      toast.error(mensagem);
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="codigo-produto">Código / modelo</Label>
              <Input
                id="codigo-produto"
                value={codigoProduto}
                onChange={(e) => setCodigoProduto(e.target.value)}
                placeholder="Ex: SVB-TRK-08"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="versao">Versão / revisão</Label>
              <Input
                id="versao"
                value={versao}
                onChange={(e) => setVersao(e.target.value)}
                placeholder="Ex: Rev. 03"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data-vigencia">Vigente até (opcional)</Label>
            <Input
              id="data-vigencia"
              type="date"
              value={dataVigencia}
              onChange={(e) => setDataVigencia(e.target.value)}
            />
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

function HistoricoDocumento({
  documentoId,
  versaoAtual,
  podeRestaurar,
  onRestaurar,
}: {
  documentoId: string;
  versaoAtual: string | null;
  podeRestaurar: boolean;
  onRestaurar: (versaoId: string) => Promise<void>;
}) {
  const { data: versoes = [], isLoading } = useQuery({
    queryKey: ["documento-versoes", documentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos_versoes")
        .select("id, versao, criado_em, dados")
        .eq("documento_id", documentoId)
        .order("versao", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <p className="py-6 text-sm text-muted-foreground">Carregando histórico...</p>;
  }

  if (versoes.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Nenhum snapshot anterior foi registrado. Revisões preenchidas antes da ativação do
        histórico não podem ser reconstruídas automaticamente; a próxima edição criará a primeira
        versão aqui.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {versoes.map((versao) => {
        const dados = versao.dados as { titulo?: string; descricao?: string | null; file_name?: string | null };
        return (
          <li key={versao.versao} className="rounded-sm border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Versão {versao.versao}</p>
              <div className="flex items-center gap-2">
                <time className="text-xs text-muted-foreground">
                  {formatarData(versao.criado_em)}
                </time>
                {podeRestaurar ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => void onRestaurar(versao.id)}
                  >
                    Restaurar
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {dados.file_name || dados.titulo || "Documento"}
              {dados.descricao ? ` · ${dados.descricao}` : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function ImportacaoLote({
  aberto,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0]);
  const [importando, setImportando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function importar(e: React.FormEvent) {
    e.preventDefault();
    if (arquivos.length === 0) {
      toast.error("Selecione pelo menos um PDF.");
      return;
    }
    setImportando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const userId = sessao.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");

      for (const arquivo of arquivos) {
        if (arquivo.size > LIMITE_BYTES) throw new Error(`${arquivo.name} passa de 50 MB.`);
        const caminho = `${userId}/${crypto.randomUUID()}-${arquivo.name}`;
        const { error: erroUpload } = await supabase.storage
          .from("documentos")
          .upload(caminho, arquivo, { contentType: "application/pdf" });
        if (erroUpload) throw new Error(`Falha ao enviar ${arquivo.name}.`);
        const { error } = await supabase.from("documentos").insert({
          titulo: arquivo.name.replace(/\.pdf$/i, ""),
          categoria,
          tipo: "file",
          storage_path: caminho,
          file_name: arquivo.name,
          file_size: arquivo.size,
          created_by: userId,
        });
        if (error) throw error;
      }
      toast.success(`${arquivos.length} PDF(s) importado(s).`);
      setArquivos([]);
      onSalvo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível importar os PDFs.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-t-[3px] border-t-gold sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Importar PDFs</DialogTitle>
          <DialogDescription>Adicione vários manuais de uma vez ao catálogo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={importar} className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-sm border-[1.5px] border-dashed border-border px-4 py-6 text-center hover:border-gold hover:bg-gold/5"
          >
            <UploadCloud className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {arquivos.length ? `${arquivos.length} arquivo(s) selecionado(s)` : "Selecionar PDFs"}
            </p>
          </button>
          <div className="space-y-1.5">
            <Label htmlFor="categoria-lote">Categoria dos documentos</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger id="categoria-lote"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" disabled={importando}>
              {importando ? "Importando..." : "Importar PDFs"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
