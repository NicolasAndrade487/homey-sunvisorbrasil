# Tela de responsáveis + cadastro só com email @sunvisorbrasil.com

## O que muda para quem usa

1. **Cadastro só com email da empresa.** Só endereços terminados em `@sunvisorbrasil.com` conseguem criar acesso. Qualquer outro recebe: "Use seu email @sunvisorbrasil.com". A regra é aplicada também no servidor, não só na tela.
2. **Sem entrada pelo Google.** O botão "Continuar com Google" sai da tela de login. Só email da empresa + senha.
3. **Confirmação de email obrigatória.** Continua como está: a pessoa precisa abrir o link enviado ao email da empresa. Isso garante que ela realmente tem aquela caixa.
4. **Nada é liberado automaticamente.** Depois de confirmar o email, a pessoa vê "Acesso aguardando liberação" e não vê nenhum documento até um responsável aprovar.
5. **Nova página de responsável (`/aprovacoes`).** Visível só para quem é responsável. Mostra três listas:
   - Pendentes: nome, email, data do pedido, botões **Aprovar** e **Recusar**.
   - Recusadas: com botão para reverter.
   - Com acesso: com botão para bloquear.
   Recusar apenas marca a conta como recusada — a pessoa vê "Seu acesso foi recusado" e pode ser liberada depois.
6. **Quem aprova.** Você não fica como aprovador do dia a dia. Passa a existir um responsável da empresa, e uma das suas contas (`nicolasmalernick@gmail.com`) fica só como reserva, para o caso de a empresa perder o acesso. A outra conta (`nicolas.andrade.23@hotmail.com`) deixa de ser responsável e continua apenas como usuária aprovada.

**Falta um dado seu:** qual é o email `@sunvisorbrasil.com` da pessoa que será a responsável. Sem ele eu preparo tudo e deixo só a conta reserva como responsável; assim que você me passar o email, eu concedo a permissão a ele.

## Publicação

A aplicação fica publicada na web, protegida por esse conjunto: só email da empresa, email confirmado, aprovação manual e regras no banco que não devolvem nenhum documento para conta não aprovada. Endereço público existe, mas quem não foi aprovado não vê conteúdo nenhum.

## Detalhes técnicos

- **Banco (migração):**
  - `profiles`: nova coluna `status text not null default 'pendente'` com valores `pendente | aprovado | recusado`, mais `decidido_em`, `decidido_por`. `aprovado` (boolean) continua existindo e é mantido em sincronia por gatilho, para não quebrar o app publicado.
  - `is_aprovado(uuid)` passa a exigir `status = 'aprovado'`; políticas de `documentos`, `profiles` e `storage.objects` continuam apoiadas nela.
  - Gatilho em `auth.users` (INSERT e na confirmação do email) que rejeita/não aprova domínio fora de `sunvisorbrasil.com`; `handle_new_user` grava `status = 'pendente'`.
  - `user_roles`: papel `admin` concedido apenas pelo responsável da empresa e pela conta reserva; remoção do papel da segunda conta pessoal.
  - Política de UPDATE em `profiles` restrita a `has_role(auth.uid(),'admin')` para os campos de status (já existente, revisada).
- **Auth:** `configure_auth` sem auto-confirmação, com HIBP ligado; provedor Google desativado no código (`handleGoogle` e botão removidos de `src/routes/auth.tsx`).
- **Frontend:**
  - `src/routes/auth.tsx`: validação de domínio no envio, remoção do bloco Google.
  - `src/routes/_authenticated/route.tsx`: lê `status` do perfil e roteia para a tela de espera/recusa.
  - Nova rota `src/routes/_authenticated/aprovacoes.tsx` usando a lógica hoje em `src/components/acessos-dialog.tsx`, que passa a ser a página completa (diálogo removido do cabeçalho, substituído por link visível só a responsáveis).
  - `src/routes/_authenticated/portal.tsx`: botão do escudo vira link para `/aprovacoes`.
- **Verificação:** typecheck, linter do banco e teste de navegador — cadastro com domínio errado bloqueado, conta pendente sem acesso a documentos, aprovação e recusa funcionando.
