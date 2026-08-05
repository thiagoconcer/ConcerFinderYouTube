# Estrutura Técnica — ConcerFinder

> **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime + pg_cron) — não negociável.
> **Caminho de build do frontend:** **Claude Code + Supabase**, app React (Vite) + Tailwind + shadcn/ui. Toda a construção do ConcerFinder (cadastro, busca semântica, painéis de leads e integração com automação) é feita em código, no Claude Code, falando com o Supabase pelo cliente `@supabase/supabase-js`.
>
> **Observação sobre automação:** o processo cita o N8N já existente na empresa para nutrição por e-mail (ActiveCampaign) e WhatsApp. Como as regras deste pacote não usam N8N, o disparo pós-cadastro será feito via **Supabase Edge Function → Make** (ou chamada direta ao webhook de nutrição que a equipe já mantém). Onde você lê "webhook de nutrição", pode plugar o fluxo existente sem retrabalho.

---

## 1. Modelo de dados

### `profiles`
Perfil de cada usuário cadastrado, estendendo `auth.users` (papel comercial e dados de contato para nutrição).
| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | uuid | PK, FK → `auth.users.id`, NOT NULL |
| `full_name` | text | NOT NULL |
| `email` | text | NOT NULL |
| `whatsapp` | text | NOT NULL |
| `commercial_role` | text | NOT NULL, CHECK IN ('vendedor','gestor_comercial','dono_empresa') |
| `role` | text | NOT NULL, default `'user'`, CHECK IN ('user','content_admin','audience_manager') |
| `created_at` | timestamptz | NOT NULL, default `now()` |
**Índices:** PK em `id`; `idx_profiles_commercial_role` em `commercial_role`; `idx_profiles_role` em `role`.

### `leads`
Registro do lead gerado no cadastro e o estado de envio para a régua de nutrição.
| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `profile_id` | uuid | FK → `profiles.id`, NOT NULL |
| `full_name` | text | NOT NULL |
| `email` | text | NOT NULL |
| `whatsapp` | text | NOT NULL |
| `commercial_role` | text | NOT NULL |
| `nurture_status` | text | NOT NULL, default `'pending'`, CHECK IN ('pending','sent','failed') |
| `nurture_sent_at` | timestamptz | NULL |
| `created_at` | timestamptz | NOT NULL, default `now()` |
**Índices:** PK; `idx_leads_profile_id` em `profile_id`; `idx_leads_nurture_status` em `nurture_status`; `idx_leads_commercial_role` em `commercial_role`.

### `videos`
Um registro por vídeo do canal do Concer capturado via scraping.
| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `youtube_video_id` | text | NOT NULL, UNIQUE |
| `title` | text | NOT NULL |
| `description` | text | NULL |
| `thumbnail_url` | text | NULL |
| `duration_seconds` | int | NULL |
| `published_at` | timestamptz | NULL |
| `transcription_status` | text | NOT NULL, default `'pending'`, CHECK IN ('pending','transcribing','transcribed','indexed','failed') |
| `indexed_at` | timestamptz | NULL |
| `created_at` | timestamptz | NOT NULL, default `now()` |
**Índices:** PK; UNIQUE em `youtube_video_id`; `idx_videos_transcription_status` em `transcription_status`; `idx_videos_published_at` em `published_at`.

### `video_segments`
Trecho transcrito de um vídeo com janela de tempo, base da busca semântica e do timestamp exato.
| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `video_id` | uuid | FK → `videos.id`, NOT NULL |
| `segment_text` | text | NOT NULL |
| `start_seconds` | int | NOT NULL |
| `end_seconds` | int | NOT NULL |
| `topic_tags` | text[] | NULL |
| `embedding` | vector(1536) | NULL (extensão `pgvector`) |
| `created_at` | timestamptz | NOT NULL, default `now()` |
**Índices:** PK; `idx_video_segments_video_id` em `video_id`; índice vetorial `idx_video_segments_embedding` do tipo `ivfflat`/`hnsw` sobre `embedding` (cosine).

### `searches`
Cada busca de dor/tema feita por um usuário cadastrado — alimenta a segmentação de audiência.
| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `profile_id` | uuid | FK → `profiles.id`, NOT NULL |
| `query_text` | text | NOT NULL |
| `detected_topics` | text[] | NULL |
| `action_plan` | text | NULL |
| `created_at` | timestamptz | NOT NULL, default `now()` |
**Índices:** PK; `idx_searches_profile_id` em `profile_id`; `idx_searches_created_at` em `created_at`; GIN `idx_searches_detected_topics` em `detected_topics`.

### `search_results`
Recomendações retornadas para cada busca (vídeo + minutagem + relevância).
| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `search_id` | uuid | FK → `searches.id`, NOT NULL |
| `video_id` | uuid | FK → `videos.id`, NOT NULL |
| `segment_id` | uuid | FK → `video_segments.id`, NOT NULL |
| `start_seconds` | int | NOT NULL |
| `similarity_score` | float | NOT NULL |
| `rank_position` | int | NOT NULL |
| `created_at` | timestamptz | NOT NULL, default `now()` |
**Índices:** PK; `idx_search_results_search_id` em `search_id`; `idx_search_results_video_id` em `video_id`; `idx_search_results_segment_id` em `segment_id`.

### `video_views`
Registro de cada abertura de `/video/:id`. Existe porque `search_results` diz o que foi **recomendado**, e nada dizia o que foi **aberto**: é esse par que sustenta o ranking de trechos do painel de audiência. **[Extensão do doc]**
| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `profile_id` | uuid | FK → `profiles.id`, NOT NULL |
| `video_id` | uuid | FK → `videos.id`, NOT NULL |
| `segment_id` | uuid | FK → `video_segments.id`, NULL (nulo quando abriu sem recomendação) |
| `search_id` | uuid | FK → `searches.id`, NULL (nulo quando chegou por link direto) |
| `start_seconds` | int | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default `now()` |
**Índices:** PK; `idx_video_views_profile_id`; `idx_video_views_video_id`; `idx_video_views_segment_id`; `idx_video_views_created_at`.

### `ingestion_runs`
Log de cada execução de scraping/transcrição/indexação (monitoramento pelo admin de conteúdo).
| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `run_type` | text | NOT NULL, CHECK IN ('scrape','transcribe','index') |
| `status` | text | NOT NULL, default `'running'`, CHECK IN ('running','completed','failed') |
| `videos_processed` | int | NOT NULL, default `0` |
| `error_message` | text | NULL |
| `started_at` | timestamptz | NOT NULL, default `now()` |
| `finished_at` | timestamptz | NULL |
**Índices:** PK; `idx_ingestion_runs_status` em `status`; `idx_ingestion_runs_started_at` em `started_at`.

---

## 2. RLS e autenticação

**Autenticação:** Supabase Auth com **e-mail + senha** e **magic link** habilitados. O magic link reduz atrito no cadastro (o objetivo primário é gerar lead). O trigger `handle_new_user` cria a linha em `profiles` no signup. O papel (`role`) padrão é `user`; papéis internos (`content_admin`, `audience_manager`) são atribuídos manualmente pela equipe Concer.

RLS **ligado em todas as tabelas**. Função auxiliar `is_concer_staff()` retorna true se o `role` do usuário for `content_admin` ou `audience_manager`.

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | dono (`id = auth.uid()`) ou staff | via trigger no signup | dono ou staff | ninguém (só service_role) |
| `leads` | staff | somente `service_role` (Edge Function no cadastro) | `service_role` (atualiza nurture_status) | ninguém |
| `videos` | qualquer usuário autenticado (SELECT) | `service_role` (ingestão) | `service_role`; staff pode marcar revisão | `service_role` |
| `video_segments` | ninguém pelo frontend — acesso só via RPC `search_videos` (SECURITY DEFINER) | `service_role` | `service_role` | `service_role` |
| `searches` | dono (`profile_id = auth.uid()`) ou staff | dono (`profile_id = auth.uid()`) | ninguém | ninguém |
| `search_results` | dono da busca associada ou staff | `service_role`/RPC | ninguém | ninguém |
| `ingestion_runs` | staff | `service_role` | `service_role` | ninguém |
| `video_views` | dono (`profile_id = auth.uid()`) ou staff | dono (`profile_id = auth.uid()`) | ninguém | ninguém |

**Regra crítica de negócio refletida no RLS:** visitante sem cadastro não vê nenhuma recomendação — `videos`/`video_segments` só respondem a usuários autenticados, e os resultados chegam apenas pela RPC `search_videos`, que exige `auth.uid()` válido.

---

## 3. Functions/endpoints

### Edge Functions (Deno)
- **`register-lead`** — chamada no submit do cadastro. Cria/garante `profiles`, insere em `leads` com `nurture_status='pending'` e dispara o webhook de nutrição (Make → ActiveCampaign + WhatsApp) atualizando `nurture_sent_at`/`nurture_status`. *Ação do usuário: concluir cadastro.*
- **`scrape-youtube-channel`** — busca a lista de vídeos do canal do Concer via YouTube Data API (ou Apify como fallback), faz upsert em `videos` com `transcription_status='pending'` e registra `ingestion_runs(run_type='scrape')`. *Chamada por cron diário e manualmente pelo admin.*
- **`transcribe-videos`** — pega vídeos `pending`, gera transcrição (áudio → texto), quebra em `video_segments` com janelas de tempo. Atualiza `transcription_status='transcribed'`. *Cron + gatilho pós-scrape.*
- **`index-segments`** — gera `embedding` de cada `video_segments` via API de embeddings e marca vídeo como `indexed`. *Cron + pós-transcrição.*
- **`search-pain`** — recebe a dor em linguagem natural, gera o embedding da consulta (a chave de embeddings não pode ir ao frontend) e chama a RPC `search_videos` com o JWT do próprio usuário. *Chamada quando o usuário submete a dor em `/busca`.*
- **`generate-action-plan`** — recebe a query do usuário e os top segmentos, gera o texto do `action_plan` com LLM. *Chamada dentro do fluxo de busca.*
- **`nurture-webhook-callback`** — recebe status de entrega do Make/N8N e atualiza `leads.nurture_status`. *Webhook externo.*

### Postgres RPCs
- **`search_videos(query_embedding, match_count)`** (SECURITY DEFINER) — busca vetorial por similaridade de cosseno em `video_segments`, retorna vídeo, `start_seconds`, `similarity_score`, `rank_position`; persiste `searches` + `search_results`. *Ação: usuário submete a dor na caixa de busca.*
- **`handle_new_user()`** (trigger) — cria `profiles` no signup.
- **`is_concer_staff()`** — helper de RLS para os painéis internos.
- **`get_audience_insights()`** (SECURITY DEFINER, staff-only) — agrega `searches.detected_topics` × `profiles.commercial_role` para o painel de audiência.
- **`get_search_results(p_search_id)`** (SECURITY DEFINER) — reabre os resultados de uma busca anterior em `/busca/historico`.
- **`get_video_detail(p_video_id)`** (SECURITY DEFINER) — metadados do vídeo e os trechos que o usuário já recuperou, para `/video/:id`.
- **`get_content_dashboard()`** (SECURITY DEFINER, staff-only) — contadores da esteira para `/admin/conteudo`.
- **`run_ingestion_step(step)`** (SECURITY DEFINER, interna) — o `pg_cron` usa para chamar as Edge Functions da esteira com o segredo guardado no Vault.

---

## 4. Páginas do frontend

- **`/`** (`landing`) — apresentação: explica que o usuário descreve qualquer dor de vendas e encontra onde o Concer fala sobre ela; CTA para cadastro.
- **`/cadastro`** (`sign-up`) — formulário de cadastro (nome, e-mail, WhatsApp, perfil comercial) que gera lead e libera a busca.
- **`/login`** (`login`) — login por senha ou magic link para usuários já cadastrados.
- **`/busca`** (`search`) — caixa onde o usuário descreve a dor em linguagem natural; exibe recomendações com vídeo, minutagem exata e plano de ação. Protegida (só autenticado).
- **`/busca/historico`** (`search-history`) — histórico de buscas do próprio usuário e novas explorações por tema.
- **`/video/:id`** (`video-detail`) — abre o vídeo no minuto do insight (deep-link para o YouTube no timestamp).
- **`/admin/conteudo`** (`admin-content`) — painel do admin de conteúdo: status de scraping/transcrição/indexação por vídeo e `ingestion_runs`. Staff-only.
- **`/admin/audiencia`** (`admin-audience`) — painel do gestor de audiência: leads, perfis e temas/dores mais buscados para segmentação. Staff-only.

---

## 5. Integrações externas
*(todas via Supabase Edge Function, nunca direto do frontend)*

- **YouTube Data API v3** — listar e obter metadados dos vídeos do canal do Concer (`scrape-youtube-channel`). Motivo: fonte oficial dos vídeos a indexar.
- **Apify** — fallback/enriquecimento de scraping quando a YouTube API não cobrir tudo (ex.: captura de legendas). Motivo: robustez na captura em massa citada na ideia.
- **API de transcrição/STT (ex.: OpenAI Whisper via API)** — transcrever áudio dos vídeos (`transcribe-videos`). Motivo: transformar vídeo em texto pesquisável.
- **API de embeddings (OpenAI `text-embedding-3-small`, 1536 dims)** — vetorizar segmentos e a query do usuário (`index-segments`, busca). Motivo: base da busca por significado, não por palavra-chave.
- **LLM para plano de ação — Claude Opus 5 (Anthropic):** gera o `action_plan` a partir dos segmentos recuperados. Motivo: contexto de 1M tokens (consolida vários trechos de transcrição com folga), raciocínio forte e a mesma conta de API que a Concer já usa. Custo US$5/Mtok in, US$25/Mtok out. O modelo é trocável pelo secret `ANTHROPIC_MODEL` e a profundidade pelo `ANTHROPIC_EFFORT`, sem republicar a função. Para pico de buscas, **Claude Sonnet 5** (US$3/Mtok in) é a alternativa custo-eficiente.
  > **Atenção:** a Anthropic **não** oferece API de embeddings. A vetorização continua obrigatoriamente na OpenAI (`text-embedding-3-small`), que é o que alimenta o `pgvector`.
- **Make → ActiveCampaign + WhatsApp / N8N existente** — disparo da régua de nutrição pós-cadastro (`register-lead`, `nurture-webhook-callback`). Motivo: automatizar a nutrição por e-mail (ActiveCampaign) e WhatsApp que você já usa, plugando no webhook existente.
- **pg_cron (Supabase)** — agenda diária de `scrape-youtube-channel` → `transcribe-videos` → `index-segments`. Motivo: garantir que novos vídeos do canal entrem na base automaticamente (regra de negócio).

**Estimativa de custo de partida:** Supabase Pro (R$125/mês — necessário para pgvector em escala e volume de edge invocations da ingestão) + uso de APIs de IA por token (transcrição/embeddings/plano de ação) + Make conforme volume. Enquanto a base de vídeos for pequena, é possível validar em free tier do Supabase.
