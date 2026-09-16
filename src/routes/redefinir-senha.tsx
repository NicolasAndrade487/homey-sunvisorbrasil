import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ChecklistSenha } from "@/components/checklist-senha";
import { MIN_SENHA, primeiroErroSenha } from "@/lib/senha";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-deep via-brand to-brand px-4 py-12">
      <div className="mb-8 font-display text-5xl font-black tracking-[0.18em] text-primary-foreground [text-shadow:2px_2px_0_rgba(255,255,255,0.15),-1px_1px_0_rgba(255,255,255,0.2)]">
        SVB
      </div>
      <div className="w-full max-w-sm rounded-sm border-t-[3px] border-t-gold bg-card p-7 shadow-lg">
        <h1 className="font-display text-xl font-semibold text-card-foreground">Nova senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha uma nova senha para acessar o portal.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
          <Button type="submit" className="w-full font-semibold" disabled={enviando}>
            {enviando ? "Atualizando..." : "Atualizar senha"}
          </Button>
        </form>
      </div>
      <p className="mt-6 text-xs text-primary-foreground/50">Acesso restrito · SVB</p>
    </div>
  );
}
