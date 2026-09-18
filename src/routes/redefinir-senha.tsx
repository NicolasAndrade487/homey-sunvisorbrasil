import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";

import logoBranca from "@/assets/svb-logo-branca.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ChecklistSenha } from "@/components/checklist-senha";
import { MIN_SENHA, primeiroErroSenha } from "@/lib/senha";

const EMAIL_SUPORTE = "suporte@sunvisorbrasil.com.br";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha · Portal SVB" },
      { name: "description", content: "Defina uma nova senha para acessar o Portal SVB." },
    ],
  }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const erro = primeiroErroSenha(senha);
    if (erro) {
      toast.error(`Senha fraca: ${erro.toLowerCase()}.`);
      return;
    }
    if (senha !== confirmacao) {
      toast.error("As senhas não são iguais.");
      return;
    }

    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      toast.error(`Não foi possível atualizar: ${error.message}`);
      return;
    }

    await supabase.auth.signOut();
    toast.success("Senha atualizada. Entre novamente no portal.");
    navigate({ to: "/auth", replace: true });
  }

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
      
      <img 
        src={logoBranca} 
        alt="SVB Sun Visor Brasil" 
        className="relative z-10 mb-8 h-12 w-auto sm:h-14" 
      />

      <div className="relative z-10 w-full max-w-sm rounded-sm border-t-[3px] border-t-gold bg-card p-7 text-center shadow-lg">
        <h1 className="font-display text-xl font-semibold text-card-foreground">
          Nova senha
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha uma nova senha para acessar o portal.
        </p>
        
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
          <div className="space-y-1.5">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <Input
              id="nova-senha"
              type="password"
              required
              minLength={MIN_SENHA}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
            />
            <ChecklistSenha senha={senha} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
            <Input
              id="confirmar-senha"
              type="password"
              required
              minLength={MIN_SENHA}
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="mt-2 w-full font-semibold" disabled={enviando}>
            {enviando ? "Atualizando..." : "Atualizar senha"}
          </Button>
        </form>

        <a
          href={`mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent("Suporte — Redefinição de senha")}`}
          className="mt-5 flex items-center justify-center gap-1 text-xs font-medium text-brand underline-offset-2 hover:underline"
        >
          <Mail className="h-3 w-3" />
          {EMAIL_SUPORTE}
        </a>
      </div>
      
      <p className="relative z-10 mt-6 text-xs text-primary-foreground/50">
        Acesso restrito · SVB
      </p>
    </div>
  );
}