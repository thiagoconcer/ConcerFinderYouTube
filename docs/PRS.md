# PRS — ConcerFinder

> Especificação de Requisitos de Sistema (Product/System Requirements Specification).
> **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime + pg_cron) — não negociável.
> **Frontend / caminho de build:** Lovable + Supabase.
> Convenção de rastreabilidade: cada RS aponta o RF do PRD que satisfaz. RFs inferidos do PROCESSO/ESTRUTURA do ConcerFinder:
> - **RF-01** — Cadastro de visitante gerando lead (nome, e-mail, WhatsApp, perfil comercial).
> - **RF-02** — Disparo automático da régua de nutrição (e-mail via ActiveCampaign + WhatsApp) pós-cadastro.
> - **RF-03** — Autenticação e controle de acesso (só cadastrado acessa a busca).
> - **RF-04** — Scraping automatizado dos vídeos do canal do Concer.
> - **RF-05** — Transcrição em massa dos vídeos em segmentos com janela de tempo.
> - **RF-06** — Indexação vetorial (embeddings) dos segmentos.
> - **RF-07** — Busca semântica por dor/tema em linguagem natural com timestamp exato.
> - **RF-08** — Geração de plano de ação a partir dos segmentos recuperados.
> - **RF-09** — Deep-link para o vídeo no minuto do insight.
> - **RF-10** — Histórico de buscas do usuário.
> - **RF-11** — Painel de conteúdo (status de scraping/transcrição/indexação).
> - **RF-12** — Painel de audiência (leads, perfis, temas/dores buscados).
> - **RF-13** — Ingestão recorrente automática de novos vídeos do canal.

---

## 1. Requisitos de sistema

**RS-01:** O endpoint `register-lead` (Edge Function) deve, ao receber o submit do cadastro, criar/garantir a linha em `profiles` e inserir uma linha em `leads` com `nurture_status='pending'` numa única transação; se qualquer passo falhar, nenhuma das duas escritas deve ser persistida.
Rastreia: RF-01

**RS-02:** O formulário de `/cadastro` deve validar que `commercial_role` ∈ ('vendedor','gestor_comercial','dono_empresa') e que `email` e `whatsapp` são não vazios antes de chamar `register-lead`; valores fora do CHECK devem ser rejeitados também no banco.
Rastreia: RF-01

**RS-03:** Após inserir o lead, `register-lead` deve disparar o webhook de nutrição (Make → ActiveCampaign + WhatsApp / N8N existente) e, conforme a resposta, atualizar `leads.nurture_status` para `'sent'` (com `nurture_sent_at=now()`) ou `'failed'`.
Rastreia: RF-02

**RS-04:** O endpoint `nurture-webhook-callback` deve aceitar chamadas externas do Make/N8N e atualizar `leads.nurture_status` para o status de entrega recebido, ignorando payloads sem `lead_id` válido.
Rastreia: RF-02

**RS-05:** A RPC `search_videos` deve rejeitar qualquer chamada sem `auth.uid()` válido; visitante não autenticado não pode obter nenhum resultado de recomendação.
Rastreia: RF-03

**RS-06:** O Supabase Auth deve permitir login por e-mail+senha e por magic link; o trigger `handle_new_user` deve criar a linha em `profiles` com `role='user'` no signup.
Rastreia: RF-03

**RS-07:** A Edge Function `scrape-youtube-channel` deve listar os vídeos do canal do Concer via YouTube Data API v3 (com Apify como fallback) e fazer upsert em `videos` por `youtube_video_id` (UNIQUE), sem duplicar vídeos já existentes, registrando `ingestion_runs(run_type='scrape')`.
Rastreia: RF-04

**RS-08:** A Edge Function `transcribe-videos` deve processar apenas vídeos com `transcription_status='pending'`, gerar segmentos em `video_segments` com `start_seconds < end_seconds` e marcar o vídeo como `'transcribed'`; falhas devem marcar `'failed'` e registrar `error_message` no `ingestion_runs`.
Rastreia: RF-05

**RS-09:** A Edge Function `index-segments` deve gerar embedding `vector(1536)` para cada segmento sem embedding e, ao concluir todos os segmentos de um vídeo, marcar `videos.transcription_status='indexed'` e preencher `indexed_at`.
Rastreia: RF-06

**RS-10:** A RPC `search_videos(query_embedding, match_count)` deve retornar os `match_count` segmentos mais similares por distância de cosseno, incluindo `video_id`, `start_seconds`, `similarity_score` e `rank_position`, e persistir uma linha em `searches` e N linhas em `search_results`.
Rastreia: RF-07

**RS-11:** A busca deve operar por significado (embedding da query), não por correspondência de palavra-chave; a query em linguagem natural deve ser vetorizada pela API de embeddings antes de chamar `search_videos`.
Rastreia: RF-07

**RS-12:** A Edge Function `generate-action-plan` deve receber a query do usuário e os top segmentos recuperados e retornar um texto de `action_plan` gravado na linha correspondente de `searches`.
Rastreia: RF-08

**RS-13:** A página `/video/:id` deve montar o deep-link do YouTube no timestamp do insight usando `start_seconds` do segmento recomendado (formato `?t=<segundos>`).
Rastreia: RF-09

**RS-14:** A página `/busca/historico` deve exibir apenas as buscas cujo `profile_id = auth.uid()`, ordenadas por `created_at` desc, sem vazar buscas de outros usuários.
Rastreia: RF-10

**RS-15:** O painel `/admin/conteudo` deve ser acessível somente a usuários com `role ∈ ('content_admin','audience_manager')` (via `is_concer_staff()`) e exibir, por vídeo, o `transcription_status` e as `ingestion_runs` recentes.
Rastreia: RF-11

**RS-16:** A RPC `get_audience_insights()` (staff-only) deve agregar `searches.detected_topics` × `profiles.commercial_role` e rejeitar chamadas de usuários não-staff.
Rastreia: RF-12

**RS-17:** O `pg_cron` deve executar diariamente a cadeia `scrape-youtube-channel` → `transcribe-videos` → `index-segments`, garantindo que novos vídeos do canal entrem na base sem intervenção manual.
Rastreia: RF-13

**RS-18:** Toda execução de ingestão deve criar uma linha em `ingestion_runs` com `started_at` e, ao término, preencher `finished_at`, `status` e `videos_processed`, permitindo auditoria no painel de conteúdo.
Rastreia: RF-11, RF-13

---

## 2. Arquitetura

O ConcerFinder é dividido em três camadas: **frontend Lovable (React)**, **backend Supabase** e **pipeline de ingestão + integrações externas** orquestrado por Edge Functions e pg_cron.

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND — Lovable (React + Tailwind + shadcn/ui)        │
│  /  /cadastro  /login  /busca  /busca/historico          │
│  /video/:id   /admin/conteudo   /admin/audiencia         │
└───────────────┬─────────────────────────┬────────────────┘
                │ Supabase JS SDK          │ RPC / Edge calls
                ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│  BACKEND — SUPABASE                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Auth (senha/ │  │ PostgreSQL   │  │ RLS por tabela │  │
│  │ magic link)  │  │ + pgvector   │  │ is_concer_staff│  │
│  └──────────────┘  └──────┬───────┘  └────────────────┘  │
│  RPCs: search_videos(SD), handle_new_user, get_audience  │
│  Edge Functions (Deno):                                  │
│   register-lead • scrape-youtube-channel •               │
│   transcribe-videos • index-segments •                   │
│   generate-action-plan • nurture-webhook-callback        │
│  pg_cron: scrape → transcribe → index (diário)           │
└───────┬───────────────────────────────────────┬─────────┘
        │                                         │
        ▼ (ingestão)                              ▼ (runtime busca / nutrição)
┌───────────────────────┐             ┌───────────────────────────┐
│ YouTube Data API v3    │             │ API embeddings (OpenAI)   │
│ Apify (fallback)       │             │ LLM plano (Gemini 2.5 Pro)│
│ STT / Whisper (áudio→  │             │ Make → ActiveCampaign +   │
│ texto)                 │             │ WhatsApp / N8N existente  │
└───────────────────────┘             └───────────────────────────┘
```

**Fluxo de ingestão (assíncrono, batch):** pg_cron aciona `scrape-youtube-channel` → grava `videos(pending)` → `transcribe-videos` gera `video_segments` → `index-segments` gera `embedding` → vídeo fica `indexed`.

**Fluxo de runtime (síncrono, usuário):** usuário descreve a dor → embedding da query → `search_videos` (busca vetorial) → `generate-action-plan` → recomendações com timestamp na tela → deep-link ao YouTube.

**Fluxo de lead/nutrição:** cadastro → `register-lead` → `leads(pending)` → webhook de nutrição → `nurture-webhook-callback` atualiza status.

---

## 3. Stack tecnológica

**Backend — Supabase (não negociável):**
- **PostgreSQL + pgvector** — dados relacionais e busca vetorial (`video_segments.embedding vector(1536)`, índice `ivfflat`/`hnsw` cosine).
- **Auth** — e-mail+senha e magic link (o magic link reduz atrito no cadastro, cujo objetivo primário é gerar lead).
- **Storage** — reservado para artefatos de transcrição/áudio quando necessário.
- **Edge Functions (Deno)** — toda lógica server-side e integrações externas (`register-lead`, `scrape-youtube-channel`, `transcribe-videos`, `index-segments`, `generate-action-plan`, `nurture-webhook-callback`).
- **Realtime** — atualização em tempo real dos painéis de status de ingestão (opcional para o admin de conteúdo).
- **pg_cron** — agenda diária da cadeia de ingestão, incorporando novos vídeos do canal automaticamente.

**Frontend — Lovable + Supabase (React + Tailwind + shadcn/ui):**
Você indicou que já opera com N8N, ActiveCampaign, Sellflux, ElephantAI e Plug AI — ou seja, um perfil **no-code/low-code**, sem menção a um time de engenharia próprio. Para o ConcerFinder (cadastro com geração de lead, busca semântica, painéis de conteúdo e audiência), o Lovable gera o app React integrado nativamente ao Supabase pelo caminho mais rápido e mantido por você, sem depender de desenvolvedores. Por isso o caminho é **Lovable**, não Claude Code.

**Integrações externas (todas via Edge Function):** YouTube Data API v3, Apify (fallback), STT/Whisper, API de embeddings OpenAI `text-embedding-3-small` (1536 dims), **Gemini 2.5 Pro** para o plano de ação (contexto longo consolidando múltiplos trechos, ~US$1.25/Mtok in; **Gemini 3.5 Flash** ~US$0.30/Mtok in como alternativa custo-eficiente sob alto volume), e Make → ActiveCampaign + WhatsApp / N8N existente para nutrição.

**Automação:** Make + Supabase Edge Functions/pg_cron. O disparo pós-cadastro pluga no webhook de nutrição que a equipe já mantém (onde você lê "webhook de nutrição", conecta o fluxo N8N/ActiveCampaign existente sem retrabalho).

**Custo de partida:** Lovable Pro (R$95/mês) + Supabase Pro (R$125/mês — necessário para pgvector em escala e volume de edge invocations da ingestão) + APIs de IA por token + Make conforme volume. Base pequena pode validar em free tier do Supabase.

---

## 4. Segurança

**Autenticação:** Supabase Auth com e-mail+senha e magic link. `handle_new_user()` cria `profiles` no signup com `role='user'`. Papéis internos (`content_admin`, `audience_manager`) são atribuídos manualmente pela equipe Concer — nunca autoatribuíveis pelo usuário.

**RLS ligado em todas as tabelas.** Resumo por tabela:

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | dono (`id=auth.uid()`) ou staff | via trigger no signup | dono ou staff | só service_role |
| `leads` | staff | só service_role (`register-lead`) | service_role | ninguém |
| `videos` | autenticado | service_role | service_role / staff (revisão) | service_role |
| `video_segments` | ninguém pelo frontend — só via RPC `search_videos` (SECURITY DEFINER) | service_role | service_role | service_role |
| `searches` | dono (`profile_id=auth.uid()`) ou staff | dono | ninguém | ninguém |
| `search_results` | dono da busca ou staff | service_role/RPC | ninguém | ninguém |
| `ingestion_runs` | staff | service_role | service_role | ninguém |

**Regra crítica de negócio no RLS:** visitante sem cadastro não vê nenhuma recomendação — `videos`/`video_segments` só respondem a usuário autenticado e resultados chegam apenas pela RPC `search_videos`, que exige `auth.uid()` válido.

**Dados sensíveis / LGPD:** `leads` e `profiles` guardam dados pessoais (nome, e-mail, WhatsApp) — base legal de coleta é o consentimento do cadastro para nutrição, que deve ser explicitado no formulário `/cadastro`. Acesso a esses dados é restrito a staff via RLS. Deve existir processo de exclusão a pedido do titular (delete via service_role). O envio a Make/ActiveCampaign/WhatsApp trafega dado pessoal e deve constar na política de privacidade.

**Segredos e API keys:** YouTube Data API, Apify, chaves OpenAI (STT/embeddings), Gemini e a URL do webhook de nutrição ficam exclusivamente em variáveis de ambiente das Edge Functions (Supabase secrets) — nunca hardcoded nem expostas no frontend Lovable. Nenhuma integração externa é chamada direto do cliente.

---

## 5. Performance

**Carga esperada:** o público-alvo é amplo (vendedores, gestores comerciais e donos de empresa interessados em vendas, atraídos pela audiência do Thiago Concer), mas o gargalo de escrita é a ingestão (centenas de vídeos do canal) e o de leitura é a busca por usuário. Buscas são ilimitadas por usuário cadastrado (regra de negócio), o que concentra a demanda de runtime nas RPCs vetoriais e no LLM de plano de ação.

**Índices críticos:**
- `idx_video_segments_embedding` (`ivfflat`/`hnsw`, cosine) — determinante para latência da busca semântica em escala.
- `idx_videos_transcription_status` — filtra rápido os vídeos `pending` no pipeline de ingestão.
- `idx_searches_detected_topics` (GIN) — agregações do painel de audiência.
- FKs indexadas (`idx_search_results_search_id`, `idx_searches_profile_id`, `idx_leads_profile_id`) — joins de histórico e painéis.

**Limites conhecidos e mitigação:**
- **Timeout de Edge Function (~60s):** `transcribe-videos` e `index-segments` devem processar em lotes pequenos (poucos vídeos/segmentos por invocação), retomando na próxima execução de cron — nunca transcrever centenas de vídeos numa única chamada.
- **Tamanho de payload:** `generate-action-plan` deve limitar o número de segmentos enviados ao LLM (top-N) para não estourar contexto/custo; Gemini 2.5 Pro (contexto longo) suporta consolidar vários trechos, mas o top-N controla custo por busca.
- **Volume de edge invocations:** a ingestão diária multiplica invocações — Supabase Pro é recomendado justamente pelo volume de edge invocations e pelo pgvector em escala.
- **Rate limits externos:** YouTube Data API e Apify têm cotas; o scrape deve paginar e respeitar limites, com Apify como fallback quando a API não cobrir legendas.
- **Latência de busca:** a vetorização da query (embeddings) + `search_videos` + plano de ação deve ficar dentro de segundos; para alto volume simultâneo, Gemini 3.5 Flash é a alternativa custo-eficiente com resposta mais imediata.
