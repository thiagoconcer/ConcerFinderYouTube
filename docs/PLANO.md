# Plano de Desenvolvimento — ConcerFinder

> **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime + pg_cron).
> **Build do frontend:** Claude Code + Supabase (React + Tailwind + shadcn/ui).
> Cada fase referencia tabelas, páginas e functions REAIS de `docs/ESTRUTURA.md`. Ordem: fundação → construção → polimento.

O ConcerFinder transforma as centenas de vídeos do canal do Thiago Concer numa base pesquisável por dor/tema. O usuário se cadastra (gerando lead + nutrição), descreve a dor de vendas em linguagem natural e recebe os vídeos certos, na minutagem exata, com plano de ação. Este plano constrói isso em 3 fases.

---

## Fase 1 — Fundação

**Entregável:** projeto no ar rodando no preview, banco criado no Supabase com todas as tabelas e RLS, autenticação (e-mail/senha + magic link) funcionando e layout base navegável.

**Tabelas:** `profiles`, `leads`, `videos`, `video_segments`, `searches`, `search_results`, `ingestion_runs` (extensão `pgvector`).
**Páginas:** `/` (landing), `/cadastro` (sign-up), `/login`.
**Functions:** trigger `handle_new_user()`, helper `is_concer_staff()`.

**Checklist:**
- [x] Criar o projeto ConcerFinder (React + Tailwind + shadcn/ui) e conectar ao Supabase
- [x] Rodar `db/schemas.sql` no Supabase (tabelas + pgvector + índices vetoriais)
- [x] Ligar RLS em todas as tabelas + criar `handle_new_user()` e `is_concer_staff()`
- [x] Configurar Supabase Auth (e-mail/senha + magic link) e a página `/login`
- [x] Montar landing `/` e cadastro `/cadastro` com layout base e navegação

**Concluída em 05/08/2026.** App publicado em `https://concer-finder.vercel.app` (deploy automático a cada push em `main` do repo `thiagoconcer/ConcerFinderYouTube`). Projeto Supabase `lzjwiibsqbowrrekptvg`: 7 tabelas, RLS ligada em todas com as policies da matriz do `docs/ESTRUTURA.md`, `pgvector 0.8.2` e índice ivfflat cosine em `video_segments.embedding vector(1536)`. Confirmação de e-mail desligada, o cadastro libera a busca na hora, conforme o `docs/PROCESSO.md`.

---

## Fase 2 — Construção

**Entregável:** o fluxo completo funcionando — ingestão dos vídeos (scraping → transcrição → indexação), busca semântica com timestamp e plano de ação, geração de lead com nutrição, e painéis internos.

**Tabelas:** todas.
**Páginas:** `/busca`, `/busca/historico`, `/video/:id`, `/admin/conteudo`, `/admin/audiencia`.
**Functions:** `scrape-youtube-channel`, `transcribe-videos`, `index-segments`, `search_videos` (RPC), `generate-action-plan`, `register-lead`, `get_audience_insights` (RPC).

**Checklist:**
- [ ] Edge Functions de ingestão: `scrape-youtube-channel` + `transcribe-videos` + `index-segments`
- [ ] RPC `search_videos` (busca vetorial) + Edge Function `generate-action-plan`
- [ ] Página `/busca` + `/video/:id` (deep-link no minuto) + `/busca/historico`
- [ ] Edge Function `register-lead` com disparo ao webhook de nutrição
- [ ] Painel `/admin/conteudo` (status de ingestão) e `/admin/audiencia` (leads + temas)

---

## Fase 3 — Polimento e lançamento

**Entregável:** app robusto e publicado — estados de vazio/erro/loading, responsividade mobile, agenda automática de ingestão via cron e deploy final.

**Tabelas:** `ingestion_runs`, `leads`.
**Páginas:** todas (revisão de UX).
**Functions:** `nurture-webhook-callback`, agenda `pg_cron`.

**Checklist:**
- [ ] Estados de vazio/erro/loading em `/busca`, painéis e cadastro + responsividade mobile
- [ ] Agendar `pg_cron` diário: scrape → transcribe → index; `nurture-webhook-callback`
- [ ] Revisão de segurança (RLS, staff-only nos painéis) e deploy final publicado
