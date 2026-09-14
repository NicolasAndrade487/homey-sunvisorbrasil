import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/svb-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar · Portal SVB" },
      {
        name: "description",
        content: "Acesse o portal interno de manuais e documentos técnicos da SVB.",
      },
      { property: "og:title", content: "Entrar · Portal SVB" },
      {
        property: "og:description",
        content: "Acesso restrito ao portal interno de documentos da SVB.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aguardandoEmail, setAguardandoEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/portal", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim().toLowerCase().endsWith(`@${DOMINIO}`)) {
      toast.error(`Use seu email @${DOMINIO}.`);
      return;
    }
    setEnviando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate({ to: "/portal", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: nome || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/portal", replace: true });
        } else {
          setAguardandoEmail(true);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível continuar.";
      toast.error(
        msg.includes("Invalid login credentials")
          ? "Email ou senha incorretos."
          : msg.includes("already registered")
            ? "Esse email já tem cadastro. Use a opção Entrar."
            : msg.includes("EMAIL_DOMINIO_NAO_AUTORIZADO")
              ? `Somente emails @${DOMINIO} podem criar acesso.`
              : msg,
      );
    } finally {
      setEnviando(false);
    }
  }


  if (aguardandoEmail) {
    return (
      <Shell>
        <h1 className="font-display text-xl font-semibold text-card-foreground">
          Confirme seu email
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enviamos um link de confirmação para <strong>{email}</strong>. Abra o link para ativar seu
          acesso e depois volte aqui para entrar.
        </p>
        <Button
          variant="outline"
          className="mt-6 w-full"
          onClick={() => {
            setAguardandoEmail(false);
            setModo("entrar");
          }}
        >
          Voltar para o login
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-display text-xl font-semibold text-card-foreground">
        {modo === "entrar" ? "Entrar no portal" : "Criar meu acesso"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Use o email da empresa para acessar o catálogo de documentos.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {modo === "criar" && (
          <div className="space-y-1.5">
            <Label htmlFor="nome">Seu nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Nicolas Andrade"
              autoComplete="name"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email da empresa</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@empresa.com.br"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
          />
        </div>
        <Button type="submit" className="w-full font-semibold" disabled={enviando}>
          {enviando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar acesso"}
        </Button>
      </form>


      <button
        type="button"
        className="mt-6 w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
      >
        {modo === "entrar" ? "Ainda não tenho acesso — criar agora" : "Já tenho acesso — entrar"}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-deep via-brand to-brand px-4 py-12">
      <img src={logo.url} alt="SVB" className="mb-8 h-11 w-auto brightness-0 invert" />
      <div className="w-full max-w-sm rounded-sm border-t-[3px] border-t-gold bg-card p-7 shadow-lg">
        {children}
      </div>
      <p className="mt-6 text-xs text-primary-foreground/50">Acesso restrito · SVB</p>
    </div>
  );
}
