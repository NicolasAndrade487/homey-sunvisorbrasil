import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Lock, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "@/assets/svb-logo.png.asset.json";

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

function Home() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-brand-deep bg-gradient-to-br from-brand-deep via-brand to-brand text-primary-foreground">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 py-24 text-center">
          <img src={logo.url} alt="SVB" className="h-14 w-auto brightness-0 invert" />
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Portal de Manuais e Documentos
            </h1>
            <p className="mt-4 max-w-xl text-base text-primary-foreground/70">
              Consulta rápida de manuais de instalação, fichas técnicas, catálogos, certificados e
              termos de garantia. Acesso exclusivo para a equipe.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="bg-gold text-gold-foreground hover:bg-gold/90 font-semibold"
          >
            <Link to={signedIn ? "/portal" : "/auth"}>
              {signedIn ? "Abrir o portal" : "Entrar com email da empresa"}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-4xl gap-4 px-6 py-16 sm:grid-cols-3">
        {[
          {
            icon: Search,
            titulo: "Busca instantânea",
            texto: "Encontre qualquer documento pelo título ou pela categoria em segundos.",
          },
          {
            icon: FileText,
            titulo: "Cadastro compartilhado",
            texto: "Toda a empresa vê o mesmo catálogo, sempre atualizado.",
          },
          {
            icon: Lock,
            titulo: "Acesso restrito",
            texto: "Nada fica público: só quem tem login da empresa consegue abrir os arquivos.",
          },
        ].map((item) => (
          <div
            key={item.titulo}
            className="rounded-sm border border-l-[3px] border-border border-l-brand bg-card p-5"
          >
            <item.icon className="h-5 w-5 text-brand" />
            <h2 className="mt-3 font-display text-base font-medium text-card-foreground">
              {item.titulo}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
