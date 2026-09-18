# 📖 Manual Técnico, de Arquitetura e Troubleshooting — Portal SVB

## 1. Visão Geral da Arquitetura e Stack
* **Framework Front-end:** TanStack Router (com rotas baseadas em arquivos e validação de sessão) + TanStack Query (gerenciamento de estado servidor, cache inteligente e revalidação).
* **UI & Estilização:** Tailwind CSS + componentes Radix UI / Shadcn.
* **Backend & Banco de Dados:** Supabase (PostgreSQL com políticas de RLS - *Row Level Security*, autenticação nativa baseada em JWT e Buckets de Storage).

---

## 2. Mapa do Código (Onde Fica Cada Regra de Negócio)

### A. Autenticação, Controle de Acesso e Perfis (`useQuery: ["meu-acesso"]`)
* **Onde fica:** No início da função principal `Portal()`.
* **O que faz:** Consulta simultaneamente a tabela `profiles` e `user_roles` para determinar o status do usuário (`aprovado`, `pendente`, `recusado`) e as bandeiras granulares de permissão (`podeLer`, `podeAtualizar`, `podeExcluir`).
* **Comportamento de Cache:** Possui `staleTime` configurado para 15 minutos para evitar consultas repetitivas ao banco a cada foco na janela do navegador.

### B. Gestão de Listagem, Cache e Performance (`useQuery: ["documentos"]`)
* **Onde fica:** Logo após a validação de acesso.
* **O que faz:** Busca todos os registros da tabela `documentos` ordenados por data de criação decrescente.
* **Comportamento de Cache:** Configurado com `staleTime` de 5 minutos. Mutações bem-sucedidas (inserções, edições e exclusões) forçam a invalidação imediata através de `queryClient.invalidateQueries`.

### C. Sistema de Favoritos e Histórico Recente
* **Onde fica:** Funções `alternarFavorito` e `registrarAcesso`.
* **O que faz:** Empregam **Atualização Otimista** (*Optimistic Updates*) combinadas com `cancelQueries`. A interface responde instantaneamente ao clique do usuário antes mesmo da resposta HTTP do banco retornar, garantindo fluidez extrema.

### D. Atalhos de Teclado e Usabilidade
* **Onde fica:** `useEffect` global com escuta para a tecla `/`.
* **O que faz:** Foca automaticamente no campo de busca ao teclar `/`, contendo salvaguardas inteligentes para ignorar iframes, caixas de texto (`INPUT`, `TEXTAREA`, `SELECT`) e conteúdos editáveis (`isContentEditable`).

---

## 3. Guia Definitivo de Resolução de Erros (Troubleshooting Completo)

| Sintoma / Erro na Tela | Causa Raiz Provável | Como Investigar (F12 / Console) | Onde e Como Arrumar |
| :--- | :--- | :--- | :--- |

| **1. Tela travada em "Verificando seu acesso..."** | Token JWT expirado, sessão corrompida no localStorage ou falha na API do Supabase. | Abra o Console do navegador (F12) e verifique se a query `meu-acesso` retornou erro `401 Unauthorized` ou `500`. | **Arrumação:** Adicione um botão de logout forçado ou limpe o cache chamando `queryClient.clear()` e redirecionando para a tela de login. |

| **2. Erro ao tentar excluir ou editar documento (Falha Silenciosa ou Toast de Erro)** | Violação de Política de Segurança RLS (*Row Level Security*) no Supabase. O ID do usuário logado perdeu a permissão na tabela `profiles`. | Olhe a aba *Network* do navegador e inspecione a resposta da mutação (geralmente retorna erro violando política de segurança). | **Arrumação:** Acesse o painel do Supabase, verifique as políticas RLS da tabela `documentos` e confirme se o perfil logado possui `pode_atualizar = true` ou se é admin na tabela `user_roles`. |

| **3. O PDF não abre no Preview (Iframe em branco ou erro de carregamento)** | A URL assinada (*Signed URL*) gerada pelo Storage do Supabase expirou (o padrão configurado expira em 300 segundos / 5 minutos). | Verifique na função `obterUrlDocumento` se o método `createSignedUrl` está retornando erro ou string vazia. | **Arrumação:** Certifique-se de que o bucket do Supabase chamado `documentos` está marcado como privado e que as permissões de leitura do bucket permitem a geração de URLs assinadas para usuários autenticados. |

| **4. Upload em Lote falha pela metade ou trava o navegador** | Um dos arquivos da seleção ultrapassa o limite de tamanho (`LIMITE_BYTES` > 50 MB) ou o formato não é estritamente PDF. | O log do console indicará qual arquivo gerou exceção durante o laço `for...of`. | **Arrumação:** O sistema já trata isso pulando o arquivo corrompido (`continue`), mas verifique a validação do tipo MIME (`application/pdf`) dentro da função `escolherArquivo`. |

| **5. A estrela de "Favorito" fica oscilando (pisca e volta ao estado anterior)** | Conflito de concorrência ou falha na Atualização Otimista (*Rollback* acionado por erro de rede). | Olhe a aba *Network* para ver se a tabela `documentos_favoritos` rejeitou a inserção por chave duplicada (`UNIQUE constraint`). | **Arrumação:** Verifique se a tabela `documentos_favoritos` possui uma chave primária composta correta (`user_id` + `documento_id`) impedindo duplicatas indesejadas. |

| **6. Alterações feitas por um usuário não aparecem para o outro imediatamente** | O cache de 5 minutos do TanStack Query (`staleTime`) está ativo na listagem passiva. | O sistema está funcionando conforme o planejado para poupar requisições, mas pode gerar atraso visual entre telas abertas simultaneamente. | **Arrumação:** Se a operação exigir tempo real absoluto (tipo chat), substitua o cache passivo por assinaturas via **Supabase Realtime** usando `supabase.channel()`. |

---

## 4. Boas Práticas e Regras de Ouro para Futuras Alterações

1. **Nunca remova o `invalidateQueries` após mutações:** Sempre que criar uma função que altera dados no banco (`insert`, `update`, `delete`), garanta que o cache correspondente seja invalidado logo em seguida para manter a consistência da interface.

2. **Tratamento de Erros em Blocos `try/catch`:** Utilize sempre mensagens amigáveis nos `toast.error` voltadas para o usuário final, e reserve o `console.error(err)` estritamente para o diagnóstico do desenvolvedor.

3. **Respeite o Foco dos Modais:** Ao criar novos inputs em formulários modais, certifique-se de que eles não interceptam atalhos globais de teclado (como a tecla `/`), evitando frustrações de usabilidade para os técnicos de campo.