import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock, ShieldCheck, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "@/assets/svb-logo.png.png";

type Status = "pendente" | "aprovado" | "recusado";
const ADMIN_EMAILS = ["admin@sunvisorbrasil.com.br", "admin@sunvisorbrasil.com"] as const;

type Pessoa = {
  id: string;
  display_name: string | null;
  email: string | null;
  status: string;
  created_at: string;
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

  const { data: pessoas = [], isLoading } = useQuery({
    queryKey: ["acessos"],
    enabled: souAdmin === true,
    queryFn: async (): Promise<Pessoa[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, status, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Pessoa[];
    },
  });

  async function definir(pessoa: Pessoa, status: Status) {
    const { error } = await supabase
      .from("profiles")
      .update({ status, decidido_em: new Date().toISOString() })
      .eq("id", pessoa.id);
    if (error) {
      toast.error("Não foi possível alterar esse acesso.");
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
          <img src={logo} alt="SVB" className="h-10 w-auto brightness-0 invert" />
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
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => void definir(p, "pendente")}
                >
                  <X className="h-4 w-4" /> Bloquear
                </Button>
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
