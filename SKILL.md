# SKILL.md — Guia Operacional de Construção do ConcerFinder

> **O que é este arquivo:** o manual que a IA de desenvolvimento (Claude Code) deve seguir para construir o **ConcerFinder** — a plataforma de busca semântica nos vídeos do canal do Thiago Concer. Não é conselho genérico: são as regras **deste** projeto. Leia antes de escrever qualquer linha e volte a ele a cada etapa.
>
> **Resumo do produto:** o usuário (vendedor, gestor comercial ou dono de empresa) descreve uma dor de vendas em linguagem natural; o ConcerFinder faz scraping do canal, transcreve os vídeos, indexa por busca vetorial e devolve **quais vídeos assistir, em qual minutagem exata e um plano de ação**. Para acessar, precisa se cadastrar (gera lead) e, no pós-cadastro, dispara nutrição por e-mail (ActiveCampaign) e WhatsApp.

---

## Convenções

- **Backend é SEMPRE Supabase** — não negociável. Postgres + Auth + Storage + Edge Functions (Deno) + Realtime + pg_cron. **Nunca** introduza Firebase, MongoDB, PlanetScale ou qualquer outro banco. O banco vetorial da busca semântica é a extensão **`pgvector` dentro do próprio Supabase** (coluna `embedding` em `video_segments`), não um serviço externo.
- **Caminho de build:** **Claude Code + Supabase**, app React (Vite) + Tailwind + shadcn/ui, com o cliente `@supabase/supabase-js` falando direto com o Supabase e deploy com preview. **Não** troque por Next.js, Vue ou Angular.
- **Nomenclatura:**
  - Tabelas e colunas: **inglês, `snake_case`** (`video_segments`, `search_results`, `created_at`).
  - Postgres Functions/RPC: **`snake_case`** (`handle_new_user`, `match_video_segments`).
  - Edge Functions e rotas de página: **`kebab-case`** (`ingest-channel`, `search-pain`, `/busca`, `/meus-resultados`).
- **Autenticação de escrita sensível:** funções que gravam em `leads`, `videos`, `video_segments`, `search_results` e `ingestion_runs` rodam com **`service_role`** — chave **jamais** exposta no frontend, só dentro de Edge Functions/Cron.
- **Idioma:** UI e conteúdo em **português brasileiro**; código, tabelas e nomes técnicos em inglês.
- **Automação/nutrição:** o disparo pós-cadastro integra com o **N8N já existente** (e ActiveCampaign para e-mail + WhatsApp). A Edge Function apenas expõe/aciona o webhook do N8N; não reconstrua a régua de nutrição dentro do Supabase.

---

## Ordem de implementação recomendada

Siga as fases de `docs/PLANO.md` (fundação → construção → polimento):

1. **Fundação — dados e acesso**
   - Aplique **`db/schemas.sql`** inteiro: `profiles`, `leads`, `videos`, `video_segments` (com `pgvector`), `search_results`, `ingestion_runs`. Habilite `pgvector` e crie o índice vetorial.
   - Ative **RLS em todas as tabelas** já na criação, com policies explícitas por operação (SELECT/INSERT/UPDATE/DELETE).
   - Configure **Auth** (e-mail + magic link) e o trigger `handle_new_user()` que popula `profiles` no signup, capturando o **perfil comercial** (vendedor / gestor / dono).

2. **Auth + cadastro que gera lead**
   - Tela de cadastro (`RF-01`): nome, e-mail, WhatsApp, perfil comercial → cria `auth.users` + `profiles` + registro em `leads`.

3. **Páginas núcleo** (na ordem de `docs/PAGINAS.md`)
   - `/` (landing/conversão) → cadastro → `/busca` (descrever a dor) → `/meus-resultados` (vídeos + timestamps + plano de ação).
   - Só depois as telas de staff: **Administrador de conteúdo** e **Gestor de audiência/comercial**.

4. **Edge Functions** (conforme `docs/FUNCTIONS.md`)
   - `ingest-channel` (scraping via YouTube API/Apify) → `transcribe-videos` (transcrição em massa) → geração de embeddings → `search-pain` (recebe a dor, chama `match_video_segments` via RPC, monta resposta com minutagem e plano de ação).

5. **Integrações externas**
   - Webhook para o **N8N** (nutrição e-mail/WhatsApp) disparado no pós-cadastro.
   - Modelo de IA para embeddings + geração de plano de ação (ver PRS/FUNCTIONS).

6. **Automação recorrente**
   - **pg_cron** para reingestão periódica do canal (novos vídeos → transcrição → embedding automático), registrando cada execução em `ingestion_runs`.

7. **Polimento**
   - Estados vazio/erro/loading, realtime no acompanhamento de ingestão, dashboards de audiência para o time comercial.

---

## Como usar cada documento durante o desenvolvimento

- **`docs/PRD.md`** — leia **antes de começar qualquer fase** para relembrar o problema real (busca por palavra-chave "deixa passar coisas no meio do vídeo") e o objetivo de negócio (acumular dados de audiência para monetizar com empresas). Use para decidir prioridades quando houver ambiguidade.
- **`docs/PRS.md`** — consulte ao implementar um requisito específico (RF-01 cadastro/lead, RF-02 nutrição). Cada RS aponta o RF que satisfaz; use como definição de "o que precisa existir".
- **`db/schemas.sql`** — **fonte única do modelo de dados.** Antes de criar/alterar qualquer coluna, confira aqui. **Não invente tabela nem coluna fora deste arquivo** — se algo faltar, atualize o schema explicitamente, não improvise no frontend.
- **`docs/PLANO.md`** — seu roteiro de sequência. Consulte no início de cada fase para saber quais tabelas/páginas/functions entram naquele momento.
- **`docs/FUNCTIONS.md`** — **antes de codar qualquer Edge Function ou RPC.** Traz convenções (kebab-case vs snake_case), padrão de autenticação `service_role` e a assinatura esperada de `ingest-channel`, `transcribe-videos`, `search-pain`, `match_video_segments`.
- **`docs/PAGINAS.md`** — **releia a seção da tela antes de construí-la.** Define rota, propósito, papéis que acessam e comportamento esperado. Não crie página que não esteja aqui.
- **`docs/DEPARA.md`** — **checklist de consistência.** Antes de criar tabela/função/página nova, confira aqui para **não duplicar** e para confirmar que os nomes batem entre banco, functions e páginas. Nenhum artefato pode ficar órfão.

---

## Gates de qualidade

Antes de considerar **qualquer etapa** pronta, verifique:

- [ ] **RLS habilitado** em toda tabela nova, com policy explícita por operação (nada de tabela aberta "só pra testar").
- [ ] Nome de tabela/coluna/função/rota **bate exatamente** com `db/schemas.sql`, `docs/FUNCTIONS.md` e `docs/DEPARA.md`.
- [ ] A **regra de negócio** do PRD/PRS foi realmente aplicada — ex.: cadastro gera registro em `leads` **e** dispara o webhook do N8N; resultado da busca traz **timestamp exato + plano de ação**, não só o vídeo.
- [ ] Estados **vazio / carregando / erro** implementados em toda página (ex.: `/busca` sem resultados, ingestão em andamento, falha de transcrição).
- [ ] Chave **`service_role` nunca aparece no frontend** — apenas em Edge Functions/Cron.
- [ ] Papel comercial (**vendedor / gestor / dono**) capturado no cadastro e respeitado nas policies e telas.
- [ ] Busca semântica usa **`pgvector` no Supabase** via `match_video_segments`, com índice vetorial criado.
- [ ] Cada nova página/função foi **conferida contra `docs/DEPARA.md`** e não deixou artefato órfão.

---

## O que NÃO fazer

- ❌ **Não** usar outro banco além do Supabase (nada de Firebase/Mongo/serviço vetorial externo) — a busca vetorial é `pgvector` no próprio Postgres.
- ❌ **Não** inventar tabela, coluna ou relacionamento fora de `db/schemas.sql`. Faltou algo? Atualize o schema formalmente.
- ❌ **Não** pular RLS "por enquanto" — toda tabela nasce com RLS e policies.
- ❌ **Não** expor `service_role` (nem chaves de YouTube/Apify, ActiveCampaign, WhatsApp) no cliente — só dentro de Edge Functions/Cron.
- ❌ **Não** reconstruir a régua de nutrição dentro do Supabase — o disparo de e-mail/WhatsApp **usa o N8N + ActiveCampaign já existentes** via webhook.
- ❌ **Não** trocar o caminho de build (nada de Next.js/Vue/Angular) — o frontend é React (Vite + Tailwind + shadcn/ui).
- ❌ **Não** misturar os papéis definidos no PROCESSO: **Visitante**, **Usuário cadastrado**, **Administrador de conteúdo** e **Gestor de audiência/comercial** têm acessos distintos; não dê tela/dado de staff a usuário final.
- ❌ **Não** entregar resultado de busca sem a **minutagem exata** e o **plano de ação** — é o diferencial central do produto; devolver só "assista esse vídeo" não atende ao PRD.
- ❌ **Não** criar página ou Edge Function que não esteja em `docs/PAGINAS.md` / `docs/FUNCTIONS.md` sem antes registrar no DE-PARA.
- ❌ **Não** rodar scraping/transcrição de forma manual improvisada — passe sempre por `ingest-channel`/`transcribe-videos` e registre em `ingestion_runs`, com reingestão via pg_cron.
