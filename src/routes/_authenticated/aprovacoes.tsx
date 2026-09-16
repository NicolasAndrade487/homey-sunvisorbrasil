import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock, ClipboardList, Mail, ShieldCheck, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type Status = "pendente" | "aprovado" | "recusado";
const ADMIN_EMAILS = ["admin@sunvisorbrasil.com.br", "admin@sunvisorbrasil.com"] as const;

type Pessoa = {
  id: string;
  display_name: string | null;
  email: string | null;
  status: string;
  created_at: string;
  tipo_usuario: "admin" | "membro";
  pode_ler: boolean;
  pode_atualizar: boolean;
  pode_excluir: boolean;
};

type LogAuditoria = {
  id: string;
  documento_id: string | null;
  usuario_id: string | null;
  acao: "criado" | "atualizado" | "excluido";
  detalhes: { titulo?: string; categoria?: string; tipo?: string } | null;
  criado_em: string;
};

export const Route = createFileRoute("/_authenticated/aprovacoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Liberação de acessos · Portal SVB" },
      {
        name: "description",
        content: "Área do responsável para liberar ou recusar contas do portal de documentos SVB.",
      },
      { property: "og:title", content: "Liberação de acessos · Portal SVB" },
      {
        property: "og:description",
        content: "Aprove ou recuse pedidos de acesso ao portal interno da SVB.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Aprovacoes,
});

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Aprovacoes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: souAdmin, isLoading: verificando } = useQuery({
    queryKey: ["sou-admin"],
    queryFn: async () => {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao.user?.id;
      const email = (sessao.user?.email ?? "").toLowerCase();
      if (!uid) return false;
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (error) return ADMIN_EMAILS.includes(email as (typeof ADMIN_EMAILS)[number]);
      return Boolean(
        data?.some((p) => p.role === "admin") ||
          ADMIN_EMAILS.includes(email as (typeof ADMIN_EMAILS)[number]),
      );
    },
  });

  useEffect(() => {
    if (souAdmin !== true) return;
    const canal = supabase
      .channel("acessos-profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["acessos"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [souAdmin, queryClient]);

  const { data: pessoas = [], isLoading } = useQuery({
    queryKey: ["acessos"],
    enabled: souAdmin === true,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Pessoa[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, display_name, email, status, created_at, tipo_usuario, pode_ler, pode_atualizar, pode_excluir",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Pessoa[];
    },
  });

  const [filtroLog, setFiltroLog] = useState<"todos" | LogAuditoria["acao"]>("todos");
  const [buscaLog, setBuscaLog] = useState("");
  const { data: logs = [], isLoading: carregandoLogs } = useQuery({
    queryKey: ["auditoria-documentos", filtroLog],
    enabled: souAdmin === true,
    queryFn: async (): Promise<LogAuditoria[]> => {
      let consulta = supabase
        .from("documentos_auditoria")
        .select("id, documento_id, usuario_id, acao, detalhes, criado_em")
        .order("criado_em", { ascending: false })
        .limit(50);
      if (filtroLog !== "todos") consulta = consulta.eq("acao", filtroLog);
      const { data, error } = await consulta;
      if (error) throw error;
      return data as LogAuditoria[];
    },
  });

  const logsVisiveis = useMemo(() => {
    const termo = buscaLog.trim().toLowerCase();
    return logs.filter((log) => {
      if (!termo) return true;
      const pessoa = pessoas.find((item) => item.id === log.usuario_id);
      return `${log.detalhes?.titulo ?? ""} ${pessoa?.display_name ?? ""} ${pessoa?.email ?? ""}`
        .toLowerCase()
        .includes(termo);
    });
  }, [logs, pessoas, buscaLog]);

  const contagemLogs = useMemo(
    () => ({
      todos: logs.length,
      criado: logs.filter((log) => log.acao === "criado").length,
      atualizado: logs.filter((log) => log.acao === "atualizado").length,
      excluido: logs.filter((log) => log.acao === "excluido").length,
    }),
    [logs],
  );

  async function definir(pessoa: Pessoa, status: Status) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        status,
        aprovado: status === "aprovado",
        decidido_em: new Date().toISOString(),
        decidido_por: (await supabase.auth.getUser()).data.user?.id ?? null,
      })
      .eq("id", pessoa.id)
      .select("id, status, aprovado");
    if (error) {
      toast.error("Não foi possível alterar esse acesso.");
      return;
    }
    if (!data || data.length === 0) {
      toast.error("A alteração não foi permitida pelo banco de dados.");
      return;
    }
    toast.success(
      status === "aprovado"
        ? "Acesso liberado."
        : status === "recusado"
          ? "Pedido recusado."
          : "Acesso bloqueado.",
    );
    queryClient.invalidateQueries({ queryKey: ["acessos"] });
  }

  async function enviarRedefinicao(pessoa: Pessoa) {
    if (!pessoa.email) {
      toast.error("Esse usuário não possui email cadastrado.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(pessoa.email, {
      redirectTo: "https://homey-sunvisorbrasil.vercel.app/redefinir-senha",
    });
    if (error) {
      toast.error(`Não foi possível enviar: ${error.message}`);
      return;
    }
    toast.success("Email de redefinição enviado.");
  }

  async function salvarPermissoes(
    pessoa: Pessoa,
    permissoes: Pick<Pessoa, "tipo_usuario" | "pode_ler" | "pode_atualizar" | "pode_excluir">,
  ) {
    const { error } = await supabase.rpc("definir_permissoes_usuario", {
      _usuario_id: pessoa.id,
      _tipo_usuario: permissoes.tipo_usuario,
      _pode_ler: permissoes.pode_ler,
      _pode_atualizar: permissoes.pode_atualizar,
      _pode_excluir: permissoes.pode_excluir,
    });
    if (error) {
      toast.error("Não foi possível salvar as permissões.");
      return;
    }
    toast.success(`Permissões de ${pessoa.display_name || pessoa.email} atualizadas.`);
    queryClient.invalidateQueries({ queryKey: ["acessos"] });
  }

  if (verificando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Verificando seu acesso...</p>
      </div>
    );
  }

  if (!souAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <ShieldCheck className="h-8 w-8 text-brand" />
        <h1 className="font-display text-xl font-semibold">Área do responsável</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Somente o responsável do portal pode liberar ou recusar contas.
        </p>
        <Button variant="outline" onClick={() => navigate({ to: "/portal" })}>
          Voltar ao portal
        </Button>
      </div>
    );
  }

  const pendentes = pessoas.filter((p) => p.status === "pendente");
  const recusados = pessoas.filter((p) => p.status === "recusado");
  const liberados = pessoas.filter((p) => p.status === "aprovado");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-[3px] border-b-gold bg-gradient-to-br from-brand-deep via-brand to-brand">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-5">
          <div className="font-display text-4xl font-black tracking-[0.18em] text-primary-foreground [text-shadow:2px_2px_0_rgba(255,255,255,0.15),-1px_1px_0_rgba(255,255,255,0.2)]">
            SVB
          </div>
          <div className="font-display text-sm leading-tight text-primary-foreground/70">
            <strong className="block text-base font-semibold text-primary-foreground">
              Liberação de acessos
            </strong>
            Quem pode entrar no portal
          </div>
          <Button
            asChild
            variant="ghost"
            className="ml-auto text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <a href="#auditoria">
              <ClipboardList className="h-4 w-4" /> Auditoria
            </a>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link to="/portal">
              <ArrowLeft className="h-4 w-4" /> Portal
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
        {isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando contas...</p>
        ) : (
          <>
            <Secao
              titulo={`Aguardando liberação (${pendentes.length})`}
              vazio="Nenhum pedido pendente."
              itens={pendentes}
              destaque
              acoes={(p) => (
                <>
                  <Button
                    size="sm"
                    className="bg-brand font-semibold text-primary-foreground hover:bg-brand/90"
                    onClick={() => void definir(p, "aprovado")}
                  >
                    <Check className="h-4 w-4" /> Aprovar
                  </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void enviarRedefinicao(p)}
                    >
                      <Mail className="h-4 w-4" /> Redefinir senha
                    </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => void definir(p, "recusado")}
                  >
                    <X className="h-4 w-4" /> Recusar
                  </Button>
                </>
              )}
            />

            <Secao
              titulo={`Com acesso (${liberados.length})`}
              vazio="Ninguém liberado ainda."
              itens={liberados}
              icone={<ShieldCheck className="h-4 w-4 flex-shrink-0 text-brand" />}
              acoes={(p) => (
                <div className="flex flex-wrap gap-2">
                  <EditorPermissoes pessoa={p} onSalvar={(permissoes) => salvarPermissoes(p, permissoes)} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void enviarRedefinicao(p)}
                  >
                    <Mail className="h-4 w-4" /> Redefinir senha
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => void definir(p, "pendente")}
                  >
                    <X className="h-4 w-4" /> Bloquear
                  </Button>
                </div>
              )}
            />

            <Secao
              titulo={`Recusadas (${recusados.length})`}
              vazio="Nenhuma conta recusada."
              itens={recusados}
              icone={<Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
              acoes={(p) => (
                <Button size="sm" variant="outline" onClick={() => void definir(p, "aprovado")}>
                  <Check className="h-4 w-4" /> Liberar
                </Button>
              )}
            />

            <section id="auditoria" className="scroll-mt-6 border-t border-border pt-8">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand">
                  <ClipboardList className="h-4 w-4" /> Auditoria do catálogo
                </h2>
                <Input
                  value={buscaLog}
                  onChange={(e) => setBuscaLog(e.target.value)}
                  placeholder="Buscar documento ou usuário"
                  className="h-8 w-full text-xs sm:w-56"
                />
              </div>
              <div className="mb-3 grid grid-cols-4 gap-2">
                {(["todos", "criado", "atualizado", "excluido"] as const).map((acao) => (
                  <button
                    key={acao}
                    type="button"
                    onClick={() => setFiltroLog(acao)}
                    className={`rounded-sm border px-2 py-2 text-left transition-colors ${
                      filtroLog === acao
                        ? "border-brand bg-brand text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-brand/40"
                    }`}
                  >
                    <span className="block text-[10px] uppercase tracking-wide opacity-75">
                      {acao === "todos" ? "Total" : acao}
                    </span>
                    <strong className="text-base">{contagemLogs[acao]}</strong>
                  </button>
                ))}
              </div>
              {carregandoLogs ? (
                <p className="py-6 text-sm text-muted-foreground">Carregando registros...</p>
              ) : logsVisiveis.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">Nenhuma ação registrada.</p>
              ) : (
                <div className="overflow-hidden rounded-sm border border-border bg-card">
                  {logsVisiveis.map((log) => {
                    const pessoa = pessoas.find((item) => item.id === log.usuario_id);
                    return (
                      <div key={log.id} className="grid gap-2 border-b border-border p-3 last:border-b-0 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{log.detalhes?.titulo || "Documento sem título"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {pessoa?.display_name || "Usuário não identificado"} · {pessoa?.email || log.usuario_id || "sem identificação"}
                          </p>
                        </div>
                        <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                          log.acao === "excluido" ? "bg-destructive/10 text-destructive" : log.acao === "criado" ? "bg-emerald-500/10 text-emerald-700" : "bg-secondary text-brand"
                        }`}>
                          {log.acao}
                        </span>
                        <time className="text-xs text-muted-foreground sm:text-right">
                          {new Date(log.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </time>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Secao({
  titulo,
  vazio,
  itens,
  acoes,
  icone,
  destaque,
}: {
  titulo: string;
  vazio: string;
  itens: Pessoa[];
  acoes: (p: Pessoa) => React.ReactNode;
  icone?: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-brand">
        {titulo}
      </h2>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((p) => (
            <li
              key={p.id}
              className={`flex flex-wrap items-center gap-3 rounded-sm border border-border bg-card p-3 ${
                destaque ? "border-l-[3px] border-l-gold" : ""
              }`}
            >
              {icone}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.display_name || "Sem nome"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.email} · pedido em {formatarData(p.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1">{acoes(p)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EditorPermissoes({
  pessoa,
  onSalvar,
}: {
  pessoa: Pessoa;
  onSalvar: (
    permissoes: Pick<Pessoa, "tipo_usuario" | "pode_ler" | "pode_atualizar" | "pode_excluir">,
  ) => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [tipoUsuario, setTipoUsuario] = useState(pessoa.tipo_usuario);
  const [podeLer, setPodeLer] = useState(pessoa.pode_ler);
  const [podeAtualizar, setPodeAtualizar] = useState(pessoa.pode_atualizar);
  const [podeExcluir, setPodeExcluir] = useState(pessoa.pode_excluir);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setTipoUsuario(pessoa.tipo_usuario);
    setPodeLer(pessoa.pode_ler);
    setPodeAtualizar(pessoa.pode_atualizar);
    setPodeExcluir(pessoa.pode_excluir);
  }, [pessoa]);

  async function salvar() {
    setSalvando(true);
    await onSalvar({
      tipo_usuario: tipoUsuario,
      pode_ler: podeLer,
      pode_atualizar: podeAtualizar,
      pode_excluir: podeExcluir,
    });
    setSalvando(false);
    setAberto(false);
  }

  if (!aberto) {
    return (
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
        Permissões
      </Button>
    );
  }

  return (
    <div className="basis-full rounded-sm border border-border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-brand">Permissões do usuário</p>
        <select
          value={tipoUsuario}
          onChange={(e) => setTipoUsuario(e.target.value as Pessoa["tipo_usuario"])}
          className="h-8 rounded-sm border border-border bg-card px-2 text-xs"
        >
          <option value="membro">Usuário comum</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ["Ler documentos", podeLer, setPodeLer],
          ["Adicionar e atualizar", podeAtualizar, setPodeAtualizar],
          ["Excluir documentos", podeExcluir, setPodeExcluir],
        ].map(([label, marcado, setMarcado]) => (
          <label key={label as string} className="flex items-center gap-2 text-xs">
            <Checkbox checked={marcado as boolean} onCheckedChange={setMarcado as (value: boolean) => void} />
            {label as string}
          </label>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
        <Button size="sm" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando..." : "Salvar permissões"}
        </Button>
      </div>
    </div>
  );
}
