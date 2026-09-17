import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FileText, Lock, Mail, Search, ShieldCheck, ArrowRight, ChevronRight } from "lucide-react";

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
    texto: "Encontre qualquer documento pelo título, código do produto ou categoria em segundos, sem perder tempo.",
  },
  {
    icon: FileText,
    titulo: "Catálogo unificado",
    texto: "Toda a empresa acessa a mesma base. Documentos sempre na última versão e com histórico preservado.",
  },
  {
    icon: Lock,
    titulo: "Acesso corporativo",
    texto: "Ambiente restrito. Apenas colaboradores autenticados com e-mail corporativo podem visualizar e baixar.",
  },
] as const;

// --- Componente Auxiliar para Efeito de Scroll ---
function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "50px" }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Home() {
  const [signedIn, setSignedIn] = useState(false);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  // Verifica a sessão atual
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

  // Monitora o scroll para alterar o header se necessário (efeito sombra)
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-brand/20 selection:text-brand-deep">
      {/* HEADER FIXO - Glassmorphism */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-brand-deep/80 shadow-md backdrop-blur-md" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={logoBranca} alt="SVB" className="h-7 w-auto sm:h-8" />
            <span className="hidden h-5 w-px bg-white/20 sm:block" />
            <span className="hidden text-sm font-medium tracking-wide text-white/90 sm:block">
              Portal de Documentos
            </span>
          </div>

          <div className="flex items-center gap-4">
            {!verificandoSessao && signedIn && (
              <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10">
                <Link to="/portal">Meu Painel</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-deep via-brand to-brand text-primary-foreground pt-16">
        {/* Textura / Pattern de Fundo */}
        <div
          aria-hidden
          className="absolute inset-0 z-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(120% 90% at 50% -10%, rgba(255,255,255,0.6), transparent 55%), repeating-linear-gradient(115deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 32px)",
          }}
        />
        
        {/* Luz de destaque suave (Glow radial) */}
        <div className="absolute left-1/2 top-1/2 -z-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-[100px]" />

        <FadeIn className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center sm:gap-8 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wider text-white/90 backdrop-blur-sm shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" />
            Acesso Restrito
          </span>

          <div className="space-y-4">
            <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl lg:leading-[1.1]">
              O acervo técnico da <span className="text-gold">SVB</span> <br className="hidden sm:block" />
              na palma da mão.
            </h1>
            <p className="mx-auto max-w-2xl text-base text-primary-foreground/80 sm:text-lg">
              Manuais de instalação, fichas técnicas, certificados e garantias centralizados. A informação certa, no momento que você precisa.
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-4 sm:w-auto">
            {verificandoSessao ? (
              <div
                aria-hidden
                className="h-12 w-full max-w-[280px] animate-pulse rounded-md bg-white/10 sm:w-64"
              />
            ) : (
              <Button
                asChild
                size="lg"
                className="group h-12 w-full bg-gold px-8 font-semibold text-gold-foreground shadow-lg transition-all hover:scale-105 hover:bg-gold/90 hover:shadow-gold/25 sm:w-auto"
              >
                <Link to={signedIn ? "/portal" : "/auth"}>
                  {signedIn ? "Acessar o portal" : "Entrar corporativo"}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            )}
            <a
              href={`mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent("Acesso ao Portal de Documentos SVB")}`}
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              <Mail className="h-3.5 w-3.5" />
              Não possui acesso? Solicite agora
              <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
            </a>
          </div>
        </FadeIn>
      </section>

      {/* SEÇÃO DE RECURSOS (CARDS) */}
      <section className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <FadeIn>
          <div className="mb-12 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-brand-deep sm:text-3xl">
              Feito para otimizar o dia a dia
            </h2>
            <p className="mt-3 text-muted-foreground">
              Esqueça buscar arquivos em pastas antigas ou grupos de mensagens.
            </p>
          </div>
        </FadeIn>

        <div className="grid gap-6 sm:grid-cols-3 lg:gap-8">
          {RECURSOS.map((item, i) => (
            <FadeIn key={item.titulo} delay={i * 150}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-brand/30 hover:shadow-xl">
                {/* Efeito Glow no fundo do card (visível no hover) */}
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/5 blur-3xl transition-colors duration-500 group-hover:bg-gold/20" />
                
                <div className="relative z-10 mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-brand transition-transform duration-300 group-hover:scale-110 group-hover:bg-brand group-hover:text-primary-foreground shadow-sm">
                  <item.icon className="h-6 w-6" />
                </div>
                
                <h3 className="relative z-10 font-display text-xl font-semibold text-card-foreground">
                  {item.titulo}
                </h3>
                <p className="relative z-10 mt-3 leading-relaxed text-muted-foreground">
                  {item.texto}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* RODAPÉ */}
      <footer className="mt-auto border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-brand font-display text-[10px] font-bold tracking-wider text-primary-foreground shadow-sm">
              SVB
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              Sun Visor Brasil <span className="mx-1 text-border">|</span> Uso Interno
            </span>
          </div>

          <a
            href={`mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent("Suporte — Portal de Documentos SVB")}`}
            className="group flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-2 transition-all hover:border-gold hover:bg-gold/5"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-brand transition-colors group-hover:bg-gold/20">
              <Mail className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-brand-deep">
              Suporte Técnico
            </span>
          </a>
        </div>
      </footer>
    </div>
  );
}