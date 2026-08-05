# DE-PARA — Matriz de Rastreabilidade — ConcerFinder

> **Objetivo:** garantir que nenhuma tabela, function/endpoint ou página fique órfã. Use este documento como checklist de consistência entre `docs/ESTRUTURA.md` (banco/backend) e as páginas do frontend React.
> Nomes: `snake_case` para tabelas e RPCs Postgres; `kebab-case` para Edge Functions e rotas de página.

---

## Tabela 1 — Tabela (DB) → Functions/Endpoints → Páginas

| Tabela | Functions/Endpoints que a tocam | Páginas que a usam | Observação |
|---|---|---|---|
| `profiles` | `handle_new_user()` (trigger INSERT no signup), `register-lead` (garante/atualiza perfil), `search_videos` (lê `profile_id` via `auth.uid()`), `get_audience_insights()` (agrega por `commercial_role`), `is_concer_staff()` (lê `role`) | `sign-up` (cria via trigger), `login`, `search` (identidade do usuário), `admin-audience` (perfis + `commercial_role`) | RLS: dono (`id = auth.uid()`) ou staff. Nunca deletado pelo frontend (só `service_role`). Papéis internos atribuídos manualmente. |
| `leads` | `register-lead` (INSERT `nurture_status='pending'` + dispara webhook), `nurture-webhook-callback` (UPDATE `nurture_status`/`nurture_sent_at`) | `sign-up` (dispara o INSERT indireto via Edge Function), `admin-audience` (SELECT staff) | INSERT/UPDATE só `service_role`. SELECT só staff. Frontend nunca escreve direto — passa por `register-lead`. |
| `videos` | `scrape-youtube-channel` (upsert), `transcribe-videos` (UPDATE `transcription_status`), `index-segments` (UPDATE `indexed_at`/`transcription_status='indexed'`), `search_videos` (JOIN nos resultados) | `search` (título/thumb nas recomendações), `video-detail` (metadados + deep-link), `admin-content` (status por vídeo) | SELECT liberado a qualquer autenticado; escrita só `service_role`. Staff pode marcar revisão. |
| `video_segments` | `transcribe-videos` (INSERT segmentos), `index-segments` (UPDATE `embedding`), `search_videos` (busca vetorial por cosseno), `get_search_results` / `get_video_detail` (leitura via RPC) | Nenhuma página lê direto — acesso apenas via RPC `SECURITY DEFINER` | Índice vetorial `ivfflat` sobre `embedding`. RLS bloqueia SELECT pelo frontend por regra de negócio (visitante não vê nada). As RPCs de leitura só devolvem trechos que o usuário já recuperou em buscas próprias. |
| `searches` | `search_videos` (INSERT da busca + `detected_topics`), `generate-action-plan` (UPDATE `action_plan`), `get_audience_insights()` (agrega `detected_topics`), `get_search_results` (lê) | `search` (registra cada dor buscada), `search-history` (lista buscas do próprio usuário), `admin-audience` (temas mais buscados) | RLS: dono (`profile_id = auth.uid()`) ou staff. INSERT pelo dono/RPC. |
| `search_results` | `search_videos` (INSERT das recomendações rankeadas via RPC), `get_search_results` / `get_video_detail` (leitura) | `search` (exibe vídeo + minutagem + score), `search-history` (resultados de buscas anteriores), `video-detail` (trechos do vídeo) | SELECT: dono da busca associada ou staff. INSERT só `service_role`/RPC. Guarda `start_seconds` para o deep-link. |
| `ingestion_runs` | `scrape-youtube-channel` (INSERT `run_type='scrape'`), `transcribe-videos` (INSERT `run_type='transcribe'`), `index-segments` (INSERT `run_type='index'`), `get_content_dashboard()` (agrega) | `admin-content` (log de execuções de scraping/transcrição/indexação) | SELECT só staff; escrita só `service_role`. Monitoramento da esteira de ingestão agendada por pg_cron. |

---

## Tabela 2 — Function/Endpoint → Tabelas → Páginas (caminho inverso)

| Function/Endpoint | Tabelas que toca | Página(s) que chama | Observação |
|---|---|---|---|
| `register-lead` (Edge) | `profiles` (upsert), `leads` (INSERT + UPDATE nurture) | `sign-up` | Chamada no submit do cadastro. Dispara webhook de nutrição (Make → ActiveCampaign + WhatsApp / N8N existente). |
| `scrape-youtube-channel` (Edge) | `videos` (upsert `pending`), `ingestion_runs` (INSERT `scrape`) | `admin-content` (botão manual) + pg_cron diário | Fonte: YouTube Data API v3 com Apify de fallback. Primeiro passo da esteira de ingestão. |
| `transcribe-videos` (Edge) | `videos` (UPDATE status), `video_segments` (INSERT segmentos), `ingestion_runs` (INSERT `transcribe`) | Nenhuma (cron + gatilho pós-scrape) | STT (ex.: OpenAI Whisper). Quebra transcrição em janelas de tempo. |
| `index-segments` (Edge) | `video_segments` (UPDATE `embedding`), `videos` (UPDATE `indexed`), `ingestion_runs` (INSERT `index`) | Nenhuma (cron + pós-transcrição) | Embeddings `text-embedding-3-small` (1536 dims) via API OpenAI. |
| `search-pain` (Edge) | nenhuma diretamente; chama a RPC `search_videos` com o JWT do usuário | `search` | **[Extensão do doc]** Gera o embedding da dor no servidor, porque a chave de embeddings não pode ir ao frontend. Também detecta os `detected_topics`. |
| `generate-action-plan` (Edge) | `searches` (UPDATE `action_plan`) | `search` (dentro do fluxo de busca) | LLM Gemini 2.5 Pro (contexto longo) para consolidar insights dos top segmentos; Gemini 3.5 Flash como alternativa custo-eficiente em alto volume. Idempotente: se o plano já existe, devolve o gravado sem nova chamada ao LLM. |
| `nurture-webhook-callback` (Edge) | `leads` (UPDATE `nurture_status`) | Nenhuma (webhook externo do Make/N8N) | Recebe status de entrega da régua de nutrição e fecha o ciclo do lead. |
| `search_videos(query_embedding, match_count)` (RPC, SECURITY DEFINER) | `video_segments` (busca vetorial), `videos` (JOIN), `searches` (INSERT), `search_results` (INSERT), `profiles` (`profile_id` via `auth.uid()`) | `search`, `search-history` | Núcleo do produto. Exige `auth.uid()` válido — visitante sem cadastro não recebe recomendação. |
| `handle_new_user()` (RPC/trigger) | `profiles` (INSERT) | `sign-up` (disparada pelo signup no Supabase Auth) | Trigger em `auth.users`. Papel padrão `user`. |
| `is_concer_staff()` (RPC helper) | `profiles` (lê `role`) | `admin-content`, `admin-audience` (guarda de acesso staff) | Helper de RLS usado nas policies dos painéis internos. |
| `get_audience_insights()` (RPC, SECURITY DEFINER, staff-only) | `searches` (`detected_topics`), `profiles` (`commercial_role`), `leads` | `admin-audience` | Cruza dores buscadas × perfil comercial para segmentação de audiência (base do modelo de receita). |
| `get_search_results(p_search_id)` (RPC, SECURITY DEFINER) | `searches`, `search_results`, `videos`, `video_segments` | `search-history` | **[Extensão do doc]** Reabre resultados persistidos. Só do dono da busca ou staff. |
| `get_video_detail(p_video_id)` (RPC, SECURITY DEFINER) | `videos`, `video_segments`, `search_results`, `searches` | `video-detail` | **[Extensão do doc]** Metadados + trechos que o próprio usuário já recuperou. |
| `get_content_dashboard()` (RPC, SECURITY DEFINER, staff-only) | `videos`, `video_segments`, `ingestion_runs` | `admin-content` | **[Extensão do doc]** Contadores da esteira de ingestão. |
| `run_ingestion_step(step)` (função interna, SECURITY DEFINER) | nenhuma; faz `net.http_post` para a Edge Function da etapa | nenhuma (só pg_cron) | **[Extensão do doc]** Lê o segredo do Vault e envia em `X-Cron-Secret`. EXECUTE revogado de anon/authenticated. |

---

### Checklist de órfãos (conferência rápida)

- **Todas as 7 tabelas** aparecem na Tabela 1: `profiles`, `leads`, `videos`, `video_segments`, `searches`, `search_results`, `ingestion_runs`. ✔
- **Todas as 7 Edge Functions + 8 RPCs/funções** aparecem na Tabela 2. ✔
- **Todas as 8 páginas** são referenciadas por ao menos uma function/tabela: `landing` (institucional, sem dados — CTA para `sign-up`), `sign-up`, `login`, `search`, `search-history`, `video-detail`, `admin-content`, `admin-audience`. ✔
- **`landing`** é a única página sem escrita/leitura de dados de negócio (apresentação + CTA); intencional, não é órfã de propósito.
- **`video_segments`** intencionalmente sem página direta — só via `search_videos` (regra de negócio de acesso restrito). ✔
