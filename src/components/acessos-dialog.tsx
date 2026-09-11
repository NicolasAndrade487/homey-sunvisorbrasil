import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ShieldCheck, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Pessoa = {
  id: string;
  nome: string | null;
  email: string | null;
  aprovado: boolean;
  created_at: string;
};

export function AcessosDialog({
  aberto,
  onFechar,
}: {
  aberto: boolean;
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: pessoas = [], isLoading } = useQuery({
    queryKey: ["acessos"],
    enabled: aberto,
    queryFn: async (): Promise<Pessoa[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, aprovado, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Pessoa[];
    },
  });

  async function definir(pessoa: Pessoa, aprovado: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ aprovado, aprovado_em: aprovado ? new Date().toISOString() : null })
      .eq("id", pessoa.id);
    if (error) {
      toast.error("Não foi possível alterar esse acesso.");
      return;
    }
    toast.success(aprovado ? "Acesso liberado." : "Acesso bloqueado.");
    queryClient.invalidateQueries({ queryKey: ["acessos"] });
  }

  const pendentes = pessoas.filter((p) => !p.aprovado);
  const liberados = pessoas.filter((p) => p.aprovado);

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-t-[3px] border-t-gold sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Quem pode entrar</DialogTitle>
          <DialogDescription>
            Contas novas ficam bloqueadas até você liberar. Sem liberação, ninguém vê nenhum
            documento.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 font-display text-sm font-semibold text-brand">
                Aguardando liberação ({pendentes.length})
              </h3>
              {pendentes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido pendente.</p>
              ) : (
                <ul className="space-y-2">
                  {pendentes.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-sm border border-l-[3px] border-border border-l-gold bg-card p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.nome || "Sem nome"}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-brand font-semibold text-primary-foreground hover:bg-brand/90"
                        onClick={() => void definir(p, true)}
                      >
                        <Check className="h-4 w-4" /> Liberar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 font-display text-sm font-semibold text-brand">
                Com acesso ({liberados.length})
              </h3>
              <ul className="space-y-2">
                {liberados.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-sm border border-border bg-card p-3"
                  >
                    <ShieldCheck className="h-4 w-4 flex-shrink-0 text-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.nome || "Sem nome"}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => void definir(p, false)}
                    >
                      <X className="h-4 w-4" /> Bloquear
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
