import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  BookOpen,
  ArrowDownAZ,
  ChevronUp,
  Clock3,
  Download,
  FileText,
  History,
  HelpCircle,
  LayoutGrid,
  List,
  LogOut,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Table2,
  Trash2,
  UploadCloud,
  X,
  Eye,
} from "lucide-react";

import logoBranca from "@/assets/svb-logo-branca.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
const EMAIL_SUPORTE = "suporte@sunvisorbrasil.com.br";
const ADMIN_EMAILS = ["admin@sunvisorbrasil.com.br", "admin@sunvisorbrasil.com"] as const;

/** Preferências de exibição sobrevivem ao reload, mas nunca quebram a tela se o storage falhar. */
function lerPreferencia<T extends string>(chave: string, valido: readonly T[], padrao: T): T {
  if (typeof window === "undefined") return padrao;
  try {
    const salvo = window.localStorage.getItem(chave) as T | null;
    return salvo && valido.includes(salvo) ? salvo : padrao;
  } catch {
    return padrao;
  }
}

function gravarPreferencia(chave: string, valor: string) {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    /* modo privado ou storage cheio: a preferência simplesmente não persiste */
  }
}

function Portal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("Todos");
  const [ordenacao, setOrdenacao] = useState<"recente" | "alfabetica">(() =>
    lerPreferencia("svb:ordenacao", ["recente", "alfabetica"] as const, "recente"),
  );
  const [visualizacao, setVisualizacao] = useState<"grade" | "lista">(() =>
    lerPreferencia("svb:visualizacao", ["grade", "lista"] as const, "grade"),
  );
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(
    () => lerPreferencia("svb:filtros", ["abertos", "fechados"] as const, "abertos") === "abertos",
  );
  const [filtroRapido, setFiltroRapido] = useState<
    "todos" | "favoritos" | "adicionados" | "acessados"
  >("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [importacaoAberta, setImportacaoAberta] = useState(false);

  const [editando, setEditando] = useState<Documento | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Documento | null>(null);
  const [documentoPreview, setDocumentoPreview] = useState<Documento | null>(null);
  const [urlPreview, setUrlPreview] = useState<string | null>(null);
  const [documentoHistorico, setDocumentoHistorico] = useState<Documento | null>(null);
  const [versaoParaRestaurar, setVersaoParaRestaurar] = useState<string | null>(null);
  const [descricaoExpandida, setDescricaoExpandida] = useState<string | null>(null);

  const areaCards = useRef<HTMLDivElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);

  useEffect(() => gravarPreferencia("svb:visualizacao", visualizacao), [visualizacao]);
  useEffect(() => gravarPreferencia("svb:ordenacao", ordenacao), [ordenacao]);
  useEffect(
    () => gravarPreferencia("svb:filtros", filtrosVisiveis ? "abertos" : "fechados"),
    [filtrosVisiveis],
  );

  /** Atalho "/" foca a busca — o técnico acha o manual sem tirar a mão do teclado. */
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "/" || evento.metaKey || evento.ctrlKey) return;
      const alvo = evento.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      if (alvo?.isContentEditable) return;
      evento.preventDefault();
      campoBusca.current?.focus();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

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

  const contagens = useMemo(() => {
    const mapa: Record<string, number> = {};
    documentos.forEach((d) => {
      mapa[d.categoria] = (mapa[d.categoria] ?? 0) + 1;
    });
    return mapa;
  }, [documentos]);

  const documentosRecentes = useMemo(
    () =>
      [...documentos]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 20)
        .map((documento) => documento.id),
    [documentos],
  );

  const documentosDaCategoria = useMemo(
    () =>
      categoriaAtiva === "Todos"
        ? documentos
        : documentos.filter((documento) => documento.categoria === categoriaAtiva),
    [documentos, categoriaAtiva],
  );

  const { data: documentosAcessados = [] } = useQuery({
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

  const contagensFiltros = useMemo(
    () => ({
      favoritos: documentosDaCategoria.filter((documento) => favoritos.includes(documento.id)).length,
      adicionados: documentosDaCategoria.filter((documento) => documentosRecentes.includes(documento.id)).length,
      acessados: documentosDaCategoria.filter((documento) => documentosAcessados.includes(documento.id)).length,
    }),
    [documentosDaCategoria, favoritos, documentosRecentes, documentosAcessados],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const resultado = documentos.filter((d) => {
      const okCategoria = categoriaAtiva === "Todos" || d.categoria === categoriaAtiva;
      const okFiltroRapido =
        filtroRapido === "todos" ||
        (filtroRapido === "favoritos" && favoritos.includes(d.id)) ||
        (filtroRapido === "adicionados" && documentosRecentes.includes(d.id)) ||
        (filtroRapido === "acessados" && documentosAcessados.includes(d.id));
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
  }, [
    documentos,
    busca,
    categoriaAtiva,
    ordenacao,
    filtroRapido,
    favoritos,
    documentosRecentes,
    documentosAcessados,
  ]);

  /** Trocar de filtro devolve a lista ao topo em vez de deixar o usuário no meio do nada. */
  useEffect(() => {
    areaCards.current?.scrollTo({ top: 0 });
  }, [categoriaAtiva, filtroRapido, busca, ordenacao]);

  const registrarAcesso = useCallback(
    (documentoId: string) => {
      if (!usuarioId) return;
      void supabase
        .from("documentos_recentes")
        .upsert(
          { user_id: usuarioId, documento_id: documentoId, acessado_em: new Date().toISOString() },
          { onConflict: "user_id,documento_id" },
        )
        .then(({ error }) => {
          if (!error) {
            void queryClient.invalidateQueries({ queryKey: ["documentos-recentes", usuarioId] });
          }
        });
    },
    [usuarioId, queryClient],
  );

  async function alternarFavorito(documentoId: string) {
    if (!usuarioId) return;
    const marcado = favoritos.includes(documentoId);
    const chaveFavoritos = ["documentos-favoritos", usuarioId] as const;
    const favoritosAnteriores = [...favoritos];
    const favoritosAtualizados = marcado
      ? favoritos.filter((id) => id !== documentoId)
      : [...favoritos, documentoId];

    queryClient.setQueryData<string[]>(chaveFavoritos, favoritosAtualizados);

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
      queryClient.setQueryData<string[]>(chaveFavoritos, favoritosAnteriores);
      toast.error(`Não foi possível atualizar o favorito: ${resultado.error.message}`);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: chaveFavoritos });
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
      if (!url) {
        toast.error("Este documento não tem arquivo nem link cadastrado. Edite-o para corrigir.");
        return;
      }
      registrarAcesso(doc.id);
      setUrlPreview(url);
      setDocumentoPreview(doc);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir o arquivo.");
    }
  }

  async function baixarDocumento(doc: Documento) {
    const url = await obterUrlDocumento(doc).catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir o arquivo.");
      return undefined;
    });
    if (url === undefined) return;
    if (!url) {
      toast.error("Este documento não tem arquivo nem link cadastrado. Edite-o para corrigir.");
      return;
    }

    const nomeArquivo = doc.file_name || `${doc.titulo}.pdf`;

    /*
     * O atributo `download` do <a> só é respeitado pelo navegador quando o link é
     * da mesma origem, ou uma blob: URL. A URL assinada do Storage é de outro domínio,
     * então sem isso o navegador abre o PDF em vez de salvar. Buscamos o arquivo como
     * blob e criamos uma URL local — só aí o "Salvar como" acontece de fato.
     */
    try {
      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error("Falha ao buscar o arquivo.");
      const blob = await resposta.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch {
      /*
       * Provavelmente um link externo (tipo "link") cujo servidor não libera CORS
       * para leitura via fetch. Nesse caso não há como forçar o download a partir
       * de outra origem — abrimos o PDF numa aba para a pessoa salvar por lá.
       */
      toast.error("Esse link não permite baixar direto por aqui. Abrindo o PDF para você salvar pela aba do navegador.");
      window.open(url, "_blank", "noopener,noreferrer");
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
    if (usuarioId) {
      const chaveFavoritos = ["documentos-favoritos", usuarioId] as const;
      const chaveAcessados = ["documentos-recentes", usuarioId] as const;
      queryClient.setQueryData<string[]>(chaveFavoritos, (atuais = []) =>
        atuais.filter((id) => id !== doc.id),
      );
      queryClient.setQueryData<string[]>(chaveAcessados, (atuais = []) =>
        atuais.filter((id) => id !== doc.id),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chaveFavoritos }),
        queryClient.invalidateQueries({ queryKey: chaveAcessados }),
      ]);
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
    navigate({ to: "/index", replace: true });
  }

  if (carregandoAcesso) {
    return (
      <div className="flex min-h-screen [min-height:100dvh] items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Verificando seu acesso...</p>
      </div>
    );
  }

  if (!aprovado) {
    return (
      <div className="relative flex min-h-screen [min-height:100dvh] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-deep via-brand to-brand px-4 py-12">
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(120% 90% at 50% -10%, rgba(255,255,255,0.55), transparent 55%), repeating-linear-gradient(115deg, rgba(255,255,255,0.55) 0px, rgba(255,255,255,0.55) 1px, transparent 1px, transparent 26px)",
          }}
        />
        <img src={logoBranca} alt="SVB Sun Visor Brasil" className="relative z-10 mb-8 h-12 w-auto sm:h-14" />
        <div className="relative z-10 w-full max-w-sm rounded-sm border-t-[3px] border-t-gold bg-card p-7 text-center shadow-lg">
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
          <LinkSuporte
            assunto={`Liberação de acesso — ${acesso?.email ?? "conta SVB"}`}
            className="mt-4 justify-center text-xs"
          />
        </div>
        <p className="relative z-10 mt-6 text-xs text-primary-foreground/50">Acesso restrito · SVB</p>
      </div>
    );
  }

  if (!acesso?.podeLer) {
    return (
      <div className="flex min-h-screen [min-height:100dvh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <ShieldCheck className="h-8 w-8 text-brand" />
        <h1 className="font-display text-xl font-semibold">Leitura não autorizada</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sua conta está aprovada, mas ainda não recebeu permissão para consultar os documentos.
        </p>
        <Button variant="outline" onClick={sair}>Sair</Button>
        <LinkSuporte
          assunto={`Permissão de leitura — ${acesso?.email ?? "conta SVB"}`}
          className="text-xs"
        />
      </div>
    );
  }

  return (
    /* Casca de altura fixa: só a área de cards rola. Header, filtros e rodapé ficam sempre visíveis. */
    <div className="flex h-screen [height:100dvh] flex-col overflow-hidden bg-background">
      <header className="relative shrink-0 overflow-hidden border-b-[3px] border-b-gold bg-gradient-to-br from-brand-deep via-brand to-brand">
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(120% 140% at 100% -30%, rgba(255,255,255,0.55), transparent 55%), repeating-linear-gradient(115deg, rgba(255,255,255,0.55) 0px, rgba(255,255,255,0.55) 1px, transparent 1px, transparent 26px)",
          }}
        />
        <div className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex flex-shrink-0 items-center gap-3 sm:gap-4">
            <img src={logoBranca} alt="SVB Sun Visor Brasil" className="h-7 w-auto sm:h-8" />
            <span className="hidden h-8 w-px bg-primary-foreground/25 sm:block" />
            <div className="hidden font-display text-sm leading-tight text-primary-foreground/70 sm:block">
              <strong className="block text-base font-semibold text-primary-foreground">
                Portal de Documentos
              </strong>
              Manuais e fichas técnicas
            </div>
          </div>

          <div className="flex w-full items-center gap-1.5 sm:ml-auto sm:w-auto sm:max-w-md sm:gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-foreground/50" />
              <Input
                ref={campoBusca}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por título, código ou revisão"
                aria-label="Buscar documento"
                className="border-primary-foreground/20 bg-primary-foreground/10 pl-9 pr-9 text-primary-foreground placeholder:text-primary-foreground/45 focus-visible:border-gold"
              />
              {busca ? (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-primary-foreground/60 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {acesso?.podeAtualizar ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Importar vários PDFs"
                  aria-label="Importar vários PDFs"
                  className="h-9 w-9 shrink-0 border border-white/30 !bg-white/15 !text-white shadow-sm hover:!bg-gold hover:!text-gold-foreground"
                  onClick={() => setImportacaoAberta(true)}
                >
                  <UploadCloud className="h-4 w-4" />
                </Button>
                <Button
                  className="shrink-0 bg-gold font-semibold text-gold-foreground hover:bg-gold/90"
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
                className="shrink-0 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to="/aprovacoes" aria-label="Liberação de acessos">
                  <ShieldCheck className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={sair}
              title="Sair"
              aria-label="Sair"
              className="shrink-0 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Bloco de filtros recolhível: some inteiro para dar a tela toda aos cards. */}
      {filtrosVisiveis ? (
        <>
          <nav className="shrink-0 border-b border-border bg-card" aria-label="Categorias">
            <div className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 py-2.5 sm:px-6">
              {["Todos", ...CATEGORIAS].map((cat) => {
                const ativo = categoriaAtiva === cat;
                const total = cat === "Todos" ? documentos.length : (contagens[cat] ?? 0);
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoriaAtiva(cat)}
                    aria-current={ativo ? "true" : undefined}
                    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      ativo
                        ? "bg-brand text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-brand"
                    }`}
                  >
                    {cat}
                    <span
                      className={`ml-1.5 text-xs ${
                        ativo ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {total}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="shrink-0 border-b border-border bg-background">
            <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2 sm:px-6">
              {(
                [
                  ["todos", "Todos", null],
                  ["favoritos", "Favoritos", Star],
                  ["adicionados", "Adicionados recentemente", Clock3],
                  ["acessados", "Acessados por mim", Eye],
                ] as const
              ).map(([valor, label, Icone]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setFiltroRapido(valor)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filtroRapido === valor
                      ? "bg-brand text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-brand"
                  }`}
                >
                  {Icone ? <Icone className="h-3.5 w-3.5" /> : null}
                  {label}
                  {valor !== "todos" ? ` (${contagensFiltros[valor]})` : null}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* Barra de ferramentas: sempre visível, é o controle da lista logo abaixo. */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="truncate font-display text-lg font-semibold text-brand-deep">
              {categoriaAtiva === "Todos" ? "Todos os documentos" : categoriaAtiva}
            </h1>
            <span className="shrink-0 text-sm text-muted-foreground">
              {filtrados.length} {filtrados.length === 1 ? "documento" : "documentos"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-brand"
              onClick={() => setFiltrosVisiveis((atual) => !atual)}
              aria-expanded={filtrosVisiveis}
            >
              {filtrosVisiveis ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <SlidersHorizontal className="h-3.5 w-3.5" />
              )}
              {filtrosVisiveis ? "Ocultar filtros" : "Mostrar filtros"}
            </Button>
            <Select value={ordenacao} onValueChange={(valor) => setOrdenacao(valor as typeof ordenacao)}>
              <SelectTrigger className="h-8 w-[130px] text-xs sm:w-[145px]" aria-label="Ordenar documentos">
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
                aria-label="Visualização em grade"
                aria-pressed={visualizacao === "grade"}
                onClick={() => setVisualizacao("grade")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={visualizacao === "lista" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                title="Visualização em lista"
                aria-label="Visualização em lista"
                aria-pressed={visualizacao === "lista"}
                onClick={() => setVisualizacao("lista")}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Único elemento rolável da página. */}
      <main ref={areaCards} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
          {isLoading ? (
            <div
              className={
                visualizacao === "grade"
                  ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  : "space-y-2"
              }
            >
              {Array.from({ length: 6 }).map((_, indice) => (
                <div
                  key={indice}
                  className="h-40 animate-pulse rounded-sm border border-l-[3px] border-border border-l-brand/30 bg-card"
                />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <h2 className="mt-4 font-display text-lg font-medium text-brand">
                Nenhum documento encontrado
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {documentos.length === 0
                  ? "Ainda não há documentos cadastrados. Adicione o primeiro."
                  : "Ajuste a busca ou escolha outra categoria."}
              </p>
              {acesso?.podeAtualizar && documentos.length === 0 ? (
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
            <div
              className={
                visualizacao === "grade"
                  ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  : "space-y-2"
              }
            >
              {filtrados.map((doc) => (
                <CartaoDocumento
                  key={doc.id}
                  doc={doc}
                  visualizacao={visualizacao}
                  favorito={favoritos.includes(doc.id)}
                  expandida={descricaoExpandida === doc.id}
                  acesso={acesso}
                  onAlternarFavorito={() => void alternarFavorito(doc.id)}
                  onExpandir={() =>
                    setDescricaoExpandida((atual) => (atual === doc.id ? null : doc.id))
                  }
                  onEditar={() => {
                    setEditando(doc);
                    setModalAberto(true);
                  }}
                  onExcluir={() => setParaExcluir(doc)}
                  onHistorico={() => setDocumentoHistorico(doc)}
                  onBaixar={() => void baixarDocumento(doc)}
                  onVisualizar={() => void visualizarDocumento(doc)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="shrink-0 border-t border-border bg-secondary/50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-brand font-display text-[10px] font-bold tracking-wide text-primary-foreground">
              SVB
            </span>
            <span className="text-xs text-muted-foreground">
              Sun Visor Brasil <span className="text-border">·</span> uso interno
            </span>
          </div>

          <a
            href={`mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent("Suporte — Portal de Documentos SVB")}`}
            title="Informe seu nome, o documento e o que aconteceu"
            className="group flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 transition-colors hover:border-gold"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand transition-colors group-hover:bg-gold/20">
              <Mail className="h-3 w-3" />
            </span>
            <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-brand">
              Precisa de ajuda?
            </span>
            <span className="hidden text-xs font-semibold text-brand sm:inline">
              {EMAIL_SUPORTE}
            </span>
          </a>
        </div>
      </footer>

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
        <DialogContent className="flex h-[90dvh] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 p-0">
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
            <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-5">
              <p className="hidden text-xs text-muted-foreground sm:block">
                O PDF não abriu aqui? Baixe o arquivo para ver no leitor do seu computador.
              </p>
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
        <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-lg">
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
              podeRestaurar={Boolean(acesso?.admin)}
              onRestaurar={(versaoId) => setVersaoParaRestaurar(versaoId)}
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
              <strong>{paraExcluir?.titulo}</strong> sairá do catálogo para toda a empresa, junto
              com o arquivo enviado. Essa ação não pode ser desfeita.
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

function LinkSuporte({
  assunto,
  className = "",
}: {
  assunto?: string;
  className?: string;
}) {
  const href = assunto
    ? `mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent(assunto)}`
    : `mailto:${EMAIL_SUPORTE}`;
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1 font-medium text-brand underline-offset-2 hover:underline ${className}`}
    >
      <Mail className="h-3 w-3" />
      {EMAIL_SUPORTE}
    </a>
  );
}

type AcessoUsuario = {
  admin: boolean;
  podeAtualizar: boolean;
  podeExcluir: boolean;
} | null | undefined;

function CartaoDocumento({
  doc,
  visualizacao,
  favorito,
  expandida,
  acesso,
  onAlternarFavorito,
  onExpandir,
  onEditar,
  onExcluir,
  onHistorico,
  onBaixar,
  onVisualizar,
}: {
  doc: Documento;
  visualizacao: "grade" | "lista";
  favorito: boolean;
  expandida: boolean;
  acesso: AcessoUsuario;
  onAlternarFavorito: () => void;
  onExpandir: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onHistorico: () => void;
  onBaixar: () => void;
  onVisualizar: () => void;
}) {
  const Icone = ICONES[doc.categoria] ?? HelpCircle;
  const desatualizado = Boolean(
    doc.data_vigencia && new Date(`${doc.data_vigencia}T23:59:59`) < new Date(),
  );
  const emLista = visualizacao === "lista";

  const selos = (
    <>
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
    </>
  );

  const botaoFavorito = (
    <Button
      variant="ghost"
      size="icon"
      className={`h-7 w-7 shrink-0 ${favorito ? "text-gold" : "text-muted-foreground"}`}
      title={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-label={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={favorito}
      onClick={onAlternarFavorito}
    >
      <Star className={`h-4 w-4 ${favorito ? "fill-current" : ""}`} />
    </Button>
  );

  /* Editar, histórico e excluir moram no menu "···": deixa o card limpo e — diferente da
     versão anterior, que escondia essas ações abaixo de "lg" na visão em lista — continua
     acessível em qualquer largura de tela. */
  const menuMais = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          title="Mais ações"
          aria-label={`Mais ações para ${doc.titulo}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onHistorico}>
          <History className="h-3.5 w-3.5" /> Histórico de versões
        </DropdownMenuItem>
        {acesso?.podeAtualizar ? (
          <DropdownMenuItem onClick={onEditar}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </DropdownMenuItem>
        ) : null}
        {acesso?.podeExcluir ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onExcluir}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const botaoBaixar = (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground"
      title="Baixar"
      aria-label={`Baixar ${doc.titulo}`}
      onClick={onBaixar}
    >
      <Download className="h-3.5 w-3.5" />
    </Button>
  );

  const botaoVisualizar = (
    <Button
      size="sm"
      className="h-8 shrink-0 bg-brand text-xs font-semibold text-primary-foreground hover:bg-brand/90"
      onClick={onVisualizar}
    >
      Visualizar <Eye className="h-3 w-3" />
    </Button>
  );

  const identificacao =
    doc.codigo_produto || doc.versao ? (
      <p className="text-xs font-medium text-brand">
        {doc.codigo_produto ? `Código: ${doc.codigo_produto}` : ""}
        {doc.codigo_produto && doc.versao ? " · " : ""}
        {doc.versao ? `Rev. ${doc.versao}` : ""}
      </p>
    ) : null;

  const rodapeMeta = (
    <span className="shrink-0 text-xs text-muted-foreground/80">
      {formatarData(doc.created_at)}
      {doc.tipo === "file" && doc.file_size ? ` · ${formatarTamanho(doc.file_size)}` : ""}
    </span>
  );

  /*
   * Lista: pilha vertical no mobile (identificação em cima, ações embaixo alinhadas à
   * direita) e vira uma linha só a partir de sm. As ações ficam sempre visíveis — a versão
   * anterior as escondia por completo abaixo de "lg", o que travava edição/exclusão no
   * celular e em tablets.
   */
  if (emLista) {
    return (
      <article className="flex flex-col gap-2.5 rounded-sm border border-l-[3px] border-border border-l-brand bg-card p-3 transition-colors hover:border-l-gold sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary">
            <Icone className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="min-w-0 truncate font-display text-base font-medium text-card-foreground">
                {doc.titulo}
              </h2>
              {selos}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {identificacao}
              {identificacao ? <span aria-hidden>·</span> : null}
              {rodapeMeta}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1 sm:ml-auto">
          {botaoFavorito}
          {menuMais}
          {botaoBaixar}
          {botaoVisualizar}
        </div>
      </article>
    );
  }

  /* Grade: card completo, com descrição. */
  return (
    <article className="flex flex-col gap-2.5 rounded-sm border border-l-[3px] border-border border-l-brand bg-card p-4 transition-all hover:border-l-gold hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-secondary">
          <Icone className="h-4 w-4 text-brand" />
        </div>
        <div className="flex flex-wrap items-start justify-end gap-1">
          {botaoFavorito}
          {selos}
        </div>
      </div>

      <h2 className="font-display text-base font-medium leading-snug text-card-foreground">
        {doc.titulo}
      </h2>
      {identificacao}

      <p
        className={`flex-1 text-sm leading-relaxed text-muted-foreground ${
          expandida ? "" : "line-clamp-3"
        }`}
      >
        {doc.descricao || "Sem descrição adicional."}
      </p>
      {doc.descricao && doc.descricao.length > 140 ? (
        <button
          type="button"
          className="self-start text-xs font-semibold text-brand hover:underline"
          onClick={onExpandir}
        >
          {expandida ? "Ver menos" : "Ver mais"}
        </button>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
        {rodapeMeta}
        <div className="flex shrink-0 items-center gap-1">
          {menuMais}
          {botaoBaixar}
          {botaoVisualizar}
        </div>
      </div>
    </article>
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
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
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
    setErroArquivo(null);
    setModo(documento?.tipo === "link" ? "link" : "upload");
  }, [aberto, documento]);

  function escolherArquivo(selecionado: File | null) {
    if (!selecionado) {
      setArquivo(null);
      setErroArquivo(null);
      return;
    }
    const ehPdf =
      selecionado.type === "application/pdf" || /\.pdf$/i.test(selecionado.name);
    if (!ehPdf) {
      setErroArquivo("Envie um arquivo em PDF.");
      setArquivo(null);
      return;
    }
    if (selecionado.size > LIMITE_BYTES) {
      setErroArquivo(
        `Esse arquivo tem ${formatarTamanho(selecionado.size)} e o limite é 50 MB. Reduza o PDF ou cadastre pelo link.`,
      );
      setArquivo(null);
      return;
    }
    setErroArquivo(null);
    setArquivo(selecionado);
  }

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

      const campos: Partial<Documento> = {
        titulo: titulo.trim(),
        categoria,
        codigo_produto: codigoProduto.trim() || null,
        versao: versao.trim() || null,
        data_vigencia: dataVigencia || null,
        descricao: descricao.trim() || null,
      };

      /* Guardado para apagar o PDF antigo só depois que a gravação der certo. */
      let caminhoAntigo: string | null = null;

      if (modo === "link") {
        const enderecoLimpo = url.trim();
        let endereco: URL;
        try {
          endereco = new URL(enderecoLimpo);
        } catch {
          throw new Error("Informe um link válido, começando com https://");
        }
        if (!/^https?:$/.test(endereco.protocol)) {
          throw new Error("O link precisa começar com http:// ou https://");
        }
        if (documento?.tipo === "file" && documento.storage_path) {
          caminhoAntigo = documento.storage_path;
        }
        campos.tipo = "link";
        campos.url = enderecoLimpo;
        campos.storage_path = null;
        campos.file_name = null;
        campos.file_size = null;
      } else {
        const jaTemArquivo = documento?.tipo === "file" && Boolean(documento.storage_path);
        if (!arquivo && !jaTemArquivo) {
          throw new Error("Escolha o arquivo PDF que será enviado.");
        }
        if (arquivo) {
          setEnviandoArquivo(true);
          const caminho = `${userId}/${crypto.randomUUID()}-${arquivo.name}`;
          const { error: erroUpload } = await supabase.storage
            .from("documentos")
            .upload(caminho, arquivo, { contentType: "application/pdf" });
          setEnviandoArquivo(false);
          if (erroUpload) {
            throw new Error(`Não foi possível enviar o arquivo: ${erroUpload.message}`);
          }
          if (jaTemArquivo) caminhoAntigo = documento!.storage_path!;
          campos.tipo = "file";
          campos.storage_path = caminho;
          campos.file_name = arquivo.name;
          campos.file_size = arquivo.size;
          campos.url = null;
        }
      }

      if (documento) {
        const { error } = await supabase.from("documentos").update(campos).eq("id", documento.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("documentos")
          .insert({ ...campos, titulo: campos.titulo!, created_by: userId });
        if (error) throw error;
      }

      if (caminhoAntigo) {
        await supabase.storage.from("documentos").remove([caminhoAntigo]);
      }

      toast.success(documento ? "Documento atualizado." : "Documento salvo no catálogo.");
      onSalvo();
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Não foi possível salvar.";
      console.error("Salvar documento falhou:", err);
      toast.error(mensagem);
    } finally {
      setEnviandoArquivo(false);
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && onFechar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-t-[3px] border-t-gold sm:max-w-md">
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
              aria-pressed={modo === m}
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
                onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
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
                    aria-label="Remover arquivo selecionado"
                    onClick={() => {
                      escolherArquivo(null);
                      if (inputArquivo.current) inputArquivo.current.value = "";
                    }}
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
                    {documento?.tipo === "file" && documento.file_name
                      ? `Atual: ${documento.file_name} — envie outro para substituir`
                      : "Tamanho máximo: 50 MB"}
                  </p>
                </button>
              )}
              {erroArquivo ? (
                <p className="text-xs font-medium text-destructive">{erroArquivo}</p>
              ) : null}
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
            <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" className="font-semibold" disabled={salvando}>
              {enviandoArquivo
                ? "Enviando arquivo..."
                : salvando
                  ? "Salvando..."
                  : "Salvar documento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoDocumento({
  documentoId,
  podeRestaurar,
  onRestaurar,
}: {
  documentoId: string;
  podeRestaurar: boolean;
  onRestaurar: (versaoId: string) => void;
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
        Nenhuma versão anterior foi registrada; a próxima edição criará a primeira
        versão aqui.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {versoes.map((versao) => {
        const dados = versao.dados as {
          titulo?: string;
          descricao?: string | null;
          file_name?: string | null;
        };
        return (
          <li key={versao.id} className="rounded-sm border border-border p-3">
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
                    onClick={() => onRestaurar(versao.id)}
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
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) {
      setArquivos([]);
      setProgresso({ feitos: 0, total: 0 });
    }
  }, [aberto]);

  async function importar(e: React.FormEvent) {
    e.preventDefault();
    if (arquivos.length === 0) {
      toast.error("Selecione pelo menos um PDF.");
      return;
    }
    const grande = arquivos.find((a) => a.size > LIMITE_BYTES);
    if (grande) {
      toast.error(`${grande.name} tem ${formatarTamanho(grande.size)} e o limite é 50 MB.`);
      return;
    }

    setImportando(true);
    setProgresso({ feitos: 0, total: arquivos.length });

    const falhas: string[] = [];
    let importados = 0;

    try {
      const { data: sessao } = await supabase.auth.getUser();
      const userId = sessao.user?.id;
      if (!userId) throw new Error("Sessão expirada. Entre novamente.");

      /* Um arquivo com problema não derruba a importação inteira. */
      for (const arquivo of arquivos) {
        const caminho = `${userId}/${crypto.randomUUID()}-${arquivo.name}`;
        const { error: erroUpload } = await supabase.storage
          .from("documentos")
          .upload(caminho, arquivo, { contentType: "application/pdf" });
        if (erroUpload) {
          falhas.push(arquivo.name);
          setProgresso((p) => ({ ...p, feitos: p.feitos + 1 }));
          continue;
        }
        const { error } = await supabase.from("documentos").insert({
          titulo: arquivo.name.replace(/\.pdf$/i, ""),
          categoria,
          tipo: "file",
          storage_path: caminho,
          file_name: arquivo.name,
          file_size: arquivo.size,
          created_by: userId,
        });
        if (error) {
          await supabase.storage.from("documentos").remove([caminho]);
          falhas.push(arquivo.name);
        } else {
          importados += 1;
        }
        setProgresso((p) => ({ ...p, feitos: p.feitos + 1 }));
      }

      if (importados > 0) {
        toast.success(`${importados} PDF(s) importado(s).`);
      }
      if (falhas.length > 0) {
        toast.error(
          `Não foi possível importar: ${falhas.slice(0, 3).join(", ")}${falhas.length > 3 ? ` e mais ${falhas.length - 3}` : ""}.`,
        );
      }
      if (importados > 0) {
        setArquivos([]);
        onSalvo();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível importar os PDFs.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(estaAberto) => !estaAberto && !importando && onFechar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-t-[3px] border-t-gold sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Importar PDFs</DialogTitle>
          <DialogDescription>
            Adicione vários manuais de uma vez. O nome do arquivo vira o título.
          </DialogDescription>
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
              {arquivos.length
                ? `${arquivos.length} arquivo(s) selecionado(s)`
                : "Selecionar PDFs"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">Até 50 MB por arquivo</p>
          </button>

          {arquivos.length > 0 ? (
            <ul className="max-h-36 space-y-1 overflow-y-auto rounded-sm border border-border p-2">
              {arquivos.map((arquivo) => (
                <li
                  key={`${arquivo.name}-${arquivo.size}`}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="min-w-0 truncate">{arquivo.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatarTamanho(arquivo.size)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="categoria-lote">Categoria dos documentos</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger id="categoria-lote">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {importando && progresso.total > 0 ? (
            <div className="space-y-1">
              <div className="h-1 overflow-hidden rounded-sm bg-secondary">
                <div
                  className="h-full bg-gold transition-all"
                  style={{ width: `${(progresso.feitos / progresso.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {progresso.feitos} de {progresso.total} enviados
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onFechar} disabled={importando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={importando}>
              {importando ? "Importando..." : "Importar PDFs"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}