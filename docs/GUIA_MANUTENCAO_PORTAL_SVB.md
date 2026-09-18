# Guia de manutencao do Portal SVB

## Visao geral

O Portal SVB e uma aplicacao React com TanStack Router, Supabase e React Query.
O catalogo principal esta na rota `/portal`.

## Arquivos principais

| Area | Arquivo |
| --- | --- |
| Catalogo, cards, filtros e preview | `src/routes/_authenticated/portal.tsx` |
| Usuarios, permissoes e auditoria | `src/routes/_authenticated/aprovacoes.tsx` |
| Login e redefinicao de senha | `src/routes/auth.tsx` |
| Tipos gerados do Supabase | `src/integrations/supabase/types.ts` |
| Cliente Supabase | `src/integrations/supabase/client.ts` |
| Estilos globais | `src/styles.css` |
| Componentes visuais | `src/components/ui/` |
| Configuracao PWA e service worker | `src/routes/__root.tsx`, `public/sw.js`, `public/manifest.webmanifest` |

## Banco de dados

As migracoes ficam em `supabase/migrations/` e devem ser executadas no Supabase SQL Editor quando o projeto nao estiver usando deploy automatico de migracoes.

| Funcionalidade | Migracao |
| --- | --- |
| Tabela de documentos e Storage | `20260910170954_35d00610-16aa-4717-84e0-263be0e38b64.sql` |
| Papeis admin/membro e bucket PDF | `20260914120000_fix_roles_and_document_storage.sql` |
| Restricao inicial de admin | `20260916130000_restringir_documentos_admin.sql` |
| Permissoes por usuario | `20260916140000_permissoes_por_usuario.sql` |
| Favoritos e acessos por usuario | `20260916150000_favoritos_documentos_recentes.sql` |
| Historico, auditoria e restauracao | `20260916160000_auditoria_historico_documentos.sql` |

## Filtros do catalogo

O filtro de categoria e controlado por `categoriaAtiva` em `portal.tsx`.
Os filtros rapidos sao controlados por `filtroRapido` e possuem quatro estados:

- `Todos`: todos os documentos.
- `Favoritos`: favoritos do usuario atual.
- `Adicionados recentemente`: os 20 documentos com maior `created_at`.
- `Acessados por mim`: os 20 documentos mais recentemente abertos pelo usuario atual.

Os contadores usam `documentosDaCategoria`. Isso e importante: ao trocar de categoria, o contador de favoritos deve considerar somente os documentos daquela categoria.

## Se um filtro mostrar numero errado

1. Abra `src/routes/_authenticated/portal.tsx`.
2. Procure `documentosDaCategoria` e `contagensFiltros`.
3. Confirme se o filtro esta usando `documentosDaCategoria`, e nao o array global.
4. Para favoritos, confira a consulta `documentos-favoritos`.
5. Para acessados, confira a consulta `documentos-recentes`.
6. Verifique se a migracao `20260916150000_favoritos_documentos_recentes.sql` foi executada.
7. Confira o console do navegador e a mensagem do toast.

## Se favorito nao atualizar imediatamente

A funcao responsavel e `alternarFavorito` em `portal.tsx`.
Ela usa atualizacao otimista:

1. Atualiza o cache local imediatamente.
2. Executa insert ou delete no Supabase.
3. Restaura o cache anterior se ocorrer erro.
4. Revalida a consulta depois do sucesso.

Se o banco retornar erro, confirme os grants e as politicas RLS da tabela `documentos_favoritos`.

## Se deletar documento e favorito continuar aparecendo

A funcao responsavel e `excluir` em `portal.tsx`.
Ela deve limpar os caches:

- `documentos-favoritos`
- `documentos-recentes`
- `documentos`

No banco, `documento_id` usa `ON DELETE CASCADE`, removendo os registros relacionados.

## Permissoes de usuarios

A tela esta em `src/routes/_authenticated/aprovacoes.tsx`.

O admin pode alterar:

- tipo `admin` ou `membro`;
- leitura;
- adicionar/atualizar;
- excluir.

A funcao RPC protegida e `definir_permissoes_usuario` na migracao de permissoes.
As politicas dos documentos usam `usuario_tem_permissao`.

Se o usuario consegue ver botoes mas recebe erro no banco, confira a migracao `20260916140000_permissoes_por_usuario.sql` e as politicas RLS.

## Auditoria

A tela administrativa fica na aba `Auditoria` de `/aprovacoes`.
A tabela `documentos_auditoria` registra:

- criado;
- atualizado;
- excluido;
- usuario;
- documento;
- data e hora.

Os triggers sao criados em `20260916160000_auditoria_historico_documentos.sql`.
Se a tela estiver vazia, verifique se essa migracao foi executada e se o usuario atual e admin.

## Alterar caixa de dialogo

-frase:Nenhum snapshot anterior foi registrado. Revisões preenchidas antes da ativação do histórico não podem ser reconstruídas automaticamente; a próxima edição criará a primeira versão aqui.
-arquivo:`src/routes/_authenticated/portal.tsx`
-Linha:1247.

## Troca do direcionamento do sair no portal

Alterar em `src/routes/_authenticated/route.tsx` /auth para / e em `src/routes/_authenticated/portal.tsx`
trocar em sair /auth para /

## Adicionar novas categorias

-adicionar em portal o icone:`src/routes/_authenticated/portal.tsx`.
-adiconar a categoria:`src/lib/documentos.ts`.

## Historico de versoes

Cada `UPDATE` em `public.documentos` salva o estado anterior em `documentos_versoes`.

O botao de historico fica nas acoes do card em `portal.tsx`.
A restauracao chama `restaurar_versao_documento`, que:

- exige admin;
- restaura os campos da versao escolhida;
- cria um novo snapshot da versao atual;
- gera auditoria pelo trigger.

Preencher `Rev. 1`, `Rev. 2` ou `Rev. 3` nao cria snapshots sozinho. O snapshot nasce quando o documento e editado depois que os triggers existem.

## Preview e download

- `obterUrlDocumento`: cria URL assinada para arquivos privados.
- `visualizarDocumento`: abre o PDF no modal.
- `baixarDocumento`: inicia o download.

Se o PDF nao abrir, confira Storage, `storage_path`, bucket `documentos` e as politicas de leitura.

## Importacao em lote

O componente `ImportacaoLote` esta em `portal.tsx`.
Ele usa o nome do arquivo como titulo e aplica uma categoria para todos os PDFs selecionados.
O usuario precisa ter `pode_atualizar`.

## Service worker e cache

Arquivos envolvidos:

- `public/sw.js`
- `public/manifest.webmanifest`
- `src/routes/__root.tsx`

Depois de publicar uma versao nova, use `Ctrl + F5`. Se ainda aparecer uma versao antiga, remova o service worker nas ferramentas do navegador ou incremente `CACHE_NAME` em `public/sw.js`.

## Checklist de diagnostico

1. Confirmar se o commit correto foi publicado.
2. Fazer `Ctrl + F5`.
3. Conferir o console do navegador.
4. Conferir o Network para respostas 401, 403 ou 404.
5. Confirmar as migracoes no Supabase.
6. Confirmar se o usuario esta aprovado.
7. Confirmar as permissoes do usuario.
8. Conferir as politicas RLS.
9. Repetir o teste com outro usuario para separar problema de perfil de problema global.

## Comandos locais

```bash
npm install
npm run dev
npm run lint
npm run build
```

O projeto atual tambem pode ser desenvolvido pelo Lovable. Nao reescreva historico publicado nem remova alteracoes existentes sem confirmar a origem.
