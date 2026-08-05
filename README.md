# ConcerFinder — Pacote de Documentação

> **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions Deno + Realtime + pg_cron) — não negociável.
> **Build do frontend:** Claude Code + Supabase (React + Tailwind + shadcn/ui).
> Este README é o **primeiro arquivo** que a IDE (Claude Code) deve ler. Ele orquestra todo o pacote: diz o que existe, em que ordem ler e como começar a construir.

---

## Sobre o projeto

O **ConcerFinder** é uma plataforma de busca inteligente sobre o acervo de vídeos do canal do **Thiago Concer** (maior referência em vendas do Brasil), voltada a vendedores, gestores comerciais e donos de empresa. Como você descreveu, o problema é que "as pessoas não sabem especificamente onde estão os insights que precisam" — a busca por palavra-chave do YouTube "deixa passar muitas coisas que estão no meio do vídeo". O ConcerFinder faz scraping do canal, transcreve os vídeos em massa, indexa tudo em um banco vetorial e permite que o usuário **descreva sua dor de vendas em linguagem natural** e receba de volta os vídeos certos, a **minutagem exata** de cada insight e um **plano de ação**. Todo acesso exige cadastro (gerando lead) e dispara automação de nutrição por e-mail (ActiveCampaign) e WhatsApp via **N8N já existente na empresa**. Os dados de intenção coletados também abrem a frente comercial que você citou: entender qual dor levou cada pessoa ao conteúdo e monetizar essa audiência com empresas parceiras.

---

## Antes de tudo

> ⚠️ **LEIA `SKILL.md` ANTES DE ESCREVER QUALQUER LINHA DE CÓDIGO OU CRIAR QUALQUER TABELA.**
>
> O `SKILL.md` é o **guia operacional** de como construir o ConcerFinder especificamente — convenções de nomenclatura, decisões de arquitetura (por que React + Supabase, como o banco vetorial e o pipeline de ingestão funcionam, como a integração com N8N/ActiveCampaign é feita via Edge Functions), padrões de RLS/segurança e a ordem correta de execução. Nenhum código deve ser escrito antes de lê-lo. Depois do `SKILL.md`, siga o `docs/PLANO.md` fase a fase.

---

## Mapa de arquivos

| Arquivo | O que contém | Quando consultar |
|---|---|---|
| **README.md** | Este arquivo. Visão geral e ponto de partida para a IDE. | Primeiro contato com o pacote. |
| **SKILL.md** | Guia operacional de como construir o ConcerFinder: decisões de arquitetura, convenções, padrões de segurança e ordem de execução. | **Antes de tudo**, sempre que houver dúvida de "como fazer". |
| **docs/PROCESSO.md** | O fluxo de negócio do ConcerFinder: papéis (visitante, usuário cadastrado, admin de conteúdo, gestor de audiência) e a jornada da dor até o plano de ação. | Para entender o "porquê" antes do "como". |
| **docs/ESTRUTURA.md** | A estrutura técnica: tabelas, Edge/Postgres functions e rotas de página — a fonte da verdade de nomenclatura. | Sempre que for nomear tabela, function ou rota. |
| **docs/PRD.md** | Product Requirements: contexto, problema, requisitos funcionais (RF-01…) e escopo. | Para saber **o que** o produto precisa fazer. |
| **docs/PRS.md** | Product/System Requirements: requisitos de sistema (RS) rastreados aos RFs do PRD. | Para detalhar o comportamento esperado de cada requisito. |
| **db/schemas.sql** | DDL completo: tabelas (`profiles`, `leads`, `videos`, `video_segments`, `search_results`, `ingestion_runs`), RLS, policies e triggers. | Ao provisionar o banco no Supabase (rodar cedo). |
| **docs/PLANO.md** | Plano de desenvolvimento em fases (fundação → construção → polimento) referenciando tabelas, páginas e functions reais. | Para saber **em que ordem** construir. |
| **docs/FUNCTIONS.md** | Edge Functions (kebab-case) e Postgres Functions (snake_case): assinatura, auth (`service_role`), triggers e cron. | Ao implementar lógica server-side, ingestão, busca semântica e integração N8N. |
| **docs/PAGINAS.md** | Páginas do frontend (rotas, propósito, componentes) do app React. | Ao construir as telas (landing, cadastro, busca, resultados, admin). |
| **docs/DEPARA.md** | Matriz de rastreabilidade Tabela → Functions → Páginas para garantir que nada fique órfão. | Como checklist de consistência ao final de cada fase. |

---

## Primeiros passos no Claude Code

> Caminho de build do ConcerFinder: app React (Vite + Tailwind + shadcn/ui) sobre Supabase, construído e mantido no Claude Code.

1. **Inicie o projeto** e o repositório Git. Frontend em React + Tailwind + shadcn/ui, para paridade com os docs.
2. **Configure o Supabase CLI:** `supabase init`, faça login (`supabase login`) e vincule ao projeto (`supabase link --project-ref <ref>`). Configure `.env` com as credenciais (publishable/anon key no cliente; `service_role` apenas no servidor/Edge Functions).
3. **Provisione o banco:** rode **`db/schemas.sql`** por inteiro, pelo **SQL Editor** do Supabase ou via `supabase db push` (o mesmo conteúdo está em `supabase/migrations/`). Isso cria todas as tabelas, RLS, policies e triggers. Habilite a extensão `pgvector` (usada em `video_segments` para a busca semântica) e confirme que `pg_cron` está ativo para a ingestão agendada.
4. **Configure os segredos** no Supabase (Edge Functions → Secrets): chave da API de transcrição/IA, chave do provedor de embeddings, `service_role` (uso interno), URL do webhook do **N8N** e credenciais de saída para ActiveCampaign/WhatsApp. Nunca exponha `service_role` no frontend.
5. **Aponte o Claude Code para ler `SKILL.md` PRIMEIRO:**

   > "Antes de qualquer código, leia `SKILL.md` por completo. Depois, use `docs/ESTRUTURA.md` como fonte de nomenclatura, `docs/FUNCTIONS.md` para as Edge/Postgres functions (ingestão via API do YouTube/Apify, transcrição em massa, geração de embeddings, busca semântica, disparo ao webhook do N8N) e `docs/PLANO.md` para a ordem de execução. O schema está em `db/schemas.sql`."

6. **Implemente as Edge Functions** de `docs/FUNCTIONS.md` (kebab-case, `service_role` para escrita em `leads`/`videos`/`video_segments`/`ingestion_runs`), configure os **cron jobs** (`pg_cron`) da ingestão recorrente e faça deploy com `supabase functions deploy`.
7. **Siga o `docs/PLANO.md`** na ordem: fundação (auth + lead + nutrição), construção (ingestão, transcrição, busca semântica, resultados) e polimento. Ao fim de cada fase, valide com `docs/DEPARA.md`.
