import { Check, X } from "lucide-react";

import { REGRAS_SENHA } from "@/lib/senha";

export function ChecklistSenha({ senha }: { senha: string }) {
  if (!senha) return null;
  return (
    <ul className="mt-2 space-y-1">
      {REGRAS_SENHA.map((regra) => {
        const ok = regra.ok(senha);
        return (
          <li
            key={regra.texto}
            className={`flex items-center gap-1.5 text-xs ${
              ok ? "text-brand" : "text-muted-foreground"
            }`}
          >
            {ok ? (
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            {regra.texto}
          </li>
        );
      })}
    </ul>
  );
}
