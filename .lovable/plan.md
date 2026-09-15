# Plano: hospedar o portal em outra plataforma e manter o administrador

## Contexto atual

O administrador do portal é definido por três camadas:

1. **Autenticação** — uma conta no sistema de auth (hoje Lovable Cloud/Supabase) com o email `admin@sunvisorbrasil.com.br`.
2. **Papel administrativo** — um registro na tabela `public.user_roles` com `role = 'admin'` vinculado ao `user_id` dessa conta.
3. **Aprovação** — um registro na tabela `public.profiles` com `status = 'aprovado'` (ou `aprovado = true`) para esse mesmo `user_id`.

Além disso, o frontend possui uma lista de emails reserva (`ADMIN_EMAILS`) em `src/routes/_authenticated/portal.tsx` e `src/routes/_authenticated/aprovacoes.tsx` que também concede poderes de admin quando o email bate, mesmo sem papel no banco.

## O que muda ao sair do Lovable Cloud

Se você levar **tudo** (frontend, banco, autenticação e arquivos) para fora, é necessário:

- Hospedar o app React/TanStack Start na nova plataforma (Vercel).
- Escolher um novo banco PostgreSQL (por exemplo: Supabase independente, Neon, AWS RDS, Render Postgres).
- Escolher um novo provedor de autenticação (por exemplo: Supabase Auth independente, Auth0, Clerk, Firebase Auth).
- Migrar o schema, os dados das tabelas e os arquivos do bucket `documentos`.
- **Recriar a conta administrador no novo sistema de auth**, porque senhas não podem ser exportadas de um provedor para outro.

Importante: a Vercel, por padrão, não fornece banco nem autenticação próprios. Ela hospeda o site e as serverless functions; o banco e o login continuam em outro serviço conectado por variáveis de ambiente.

## Passo a passo para manter `admin@sunvisorbrasil.com.br` como administrador

1. **Escolher a nova stack de backend**
   - Opção mais simples: manter Supabase fora do Lovable (projeto próprio) para banco + auth + storage.
   - Alternativas: Neon/Render/RDS para banco + Auth0/Clerk/Firebase para auth + S3/R2 para PDFs.

2. **Exportar o schema atual**
   - Reproduzir as tabelas `profiles`, `user_roles`, `documentos`, o enum `app_role`, as funções (`handle_new_user`, `has_role`, `is_aprovado`, `guard_profile_status`, `sync_status_aprovado`, `set_updated_at`) e as políticas RLS no novo banco.

3. **Migrar os dados**
   - Copiar as linhas de `profiles`, `user_roles` e `documentos`.
   - Não copiar a tabela `auth.users` (isso não é possível com senhas). As contas precisam ser recriadas no novo provedor de auth.

4. **Recriar o bucket de arquivos**
   - Criar um bucket privado equivalente ao `documentos`.
   - Reenviar os PDFs ou usar ferramenta de migração do próprio storage.

5. **Recriar o administrador**
   - Criar a conta `admin@sunvisorbrasil.com.br` no novo provedor de auth.
   - Anotar o novo `user_id` gerado.
   - Inserir na tabela `profiles`: `id = novo_user_id`, `email = admin@sunvisorbrasil.com.br`, `display_name = 'Administrador SVB'`, `status = 'aprovado'`, `aprovado = true`.
   - Inserir na tabela `user_roles`: `user_id = novo_user_id`, `role = 'admin'`.
   - Definir uma senha segura e entregá-la de forma privada.

6. **Ajustar o código do frontend**
   - Atualizar as variáveis de ambiente para apontar para o novo banco/auth/storage.
   - Decidir se mantém a lista `ADMIN_EMAILS` como segurança extra ou remove e confia apenas na tabela `user_roles`.
   - Se manter, garantir que `admin@sunvisorbrasil.com.br` esteja nela.

7. **Testar o fluxo de liberação de acessos**
   - Fazer login com `admin@sunvisorbrasil.com.br`.
   - Verificar se o escudo "Liberação de acessos" aparece.
   - Criar uma conta de teste e aprovar/recusar para confirmar que a função `guard_profile_status()` e as políticas RLS estão funcionando.

## Decisões pendentes

- Qual provedor de backend será usado na nova plataforma? (recomendação: Supabase independente, para manter o mesmo schema e funções com menos retrabalho)
- Quem terá a senha inicial do administrador e como ela será entregue?
- A lista `ADMIN_EMAILS` no frontend deve continuar como fallback ou ser removida para evitar dupla fonte de verdade?

## Resultado esperado

Após a migração, `admin@sunvisorbrasil.com.br` continua sendo o administrador do portal, com acesso à tela de liberação de acessos e poder para aprovar, recusar ou bloquear contas, exatamente como funciona hoje.
