import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Lock, Mail, Search, ShieldCheck } from "lucide-react";

import logoBranca from "@/assets/svb-logo-branca.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const EMAIL_SUPORTE = "suporte@sunvisorbrasil.com.br";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SVB · Portal de Manuais e Documentos" },
      {
        name: "description",
        content:
          "Acesso restrito ao portal interno da SVB: manuais, fichas técnicas, catálogos e certificados em um só lugar.",
      },
      { property: "og:title", content: "SVB · Portal de Manuais e Documentos" },
      {
        property: "og:description",
        content: "Acesso restrito aos manuais e documentos técnicos da SVB.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const RECURSOS = [
  {
    icon: Search,
    titulo: "Busca instantânea",
    texto: "Encontre qualquer documento pelo título, código do produto ou categoria em segundos.",
  },
  {
    icon: FileText,
    titulo: "Cadastro compartilhado",
    texto: "Toda a empresa vê o mesmo catálogo, sempre atualizado e com histórico de versões.",
  },
  {
    icon: Lock,
    titulo: "Acesso restrito",
    texto: "Nada fica público: só quem tem login da empresa consegue abrir os arquivos.",
  },
] as const;

function Home() {
  const [signedIn, setSignedIn] = useState(false);
  /* Evita o CTA "piscar" com o texto errado por uma fração de segundo enquanto a
     sessão é verificada — mostra um esqueleto até termos a resposta de verdade. */
  const [verificandoSessao, setVerificandoSessao] = useState(true);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSignedIn(Boolean(data.session));
      setVerificandoSessao(false);
    });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-deep via-brand to-brand text-primary-foreground">
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(120% 90% at 50% -10%, rgba(255,255,255,0.55), transparent 55%), repeating-linear-gradient(115deg, rgba(255,255,255,0.55) 0px, rgba(255,255,255,0.55) 1px, transparent 1px, transparent 26px)",
          }}
        />
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center sm:gap-8 sm:px-6 sm:py-20 lg:py-28">
          <img
            src={logoBranca}
            alt="SVB Sun Visor Brasil"
            className="h-12 w-auto sm:h-14 lg:h-16"
          />

          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1 text-xs font-medium text-primary-foreground/80">
            <ShieldCheck className="h-3 w-3" />
            Uso interno · Sun Visor Brasil
          </span>

          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Portal de Manuais e Documentos
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-primary-foreground/70 sm:text-base">
              Consulta rápida de manuais de instalação, fichas técnicas, catálogos, certificados e
              termos de garantia. Acesso exclusivo para a equipe.
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-3 sm:w-auto">
            {verificandoSessao ? (
              <div
                aria-hidden
                className="h-11 w-full max-w-xs animate-pulse rounded-sm bg-primary-foreground/15 sm:w-48"
              />
            ) : (
              <Button
                asChild
                size="lg"
                className="w-full bg-gold font-semibold text-gold-foreground hover:bg-gold/90 sm:w-auto"
              >
                <Link to={signedIn ? "/portal" : "/auth"}>
                  {signedIn ? "Abrir o portal" : "Entrar com email da empresa"}
                </Link>
              </Button>
            )}
            <a
              href={`mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent("Acesso ao Portal de Documentos SVB")}`}
              className="inline-flex items-center gap-1.5 text-xs text-primary-foreground/60 transition-colors hover:text-primary-foreground"
            >
              <Mail className="h-3 w-3" />
              Ainda não tem acesso? Fale com o responsável do portal
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-4xl flex-1 gap-4 px-4 py-12 sm:grid-cols-3 sm:px-6 sm:py-16">
        {RECURSOS.map((item) => (
          <div
            key={item.titulo}
            className="rounded-sm border border-l-[3px] border-border border-l-brand bg-card p-5 transition-colors hover:border-l-gold"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-secondary">
              <item.icon className="h-4 w-4 text-brand" />
            </div>
            <h2 className="mt-3 font-display text-base font-medium text-card-foreground">
              {item.titulo}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.texto}</p>
          </div>
        ))}
      </section>

      <footer className="shrink-0 border-t border-border bg-secondary/50">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
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
    </div>
  );
}