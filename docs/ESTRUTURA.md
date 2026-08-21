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
| `commercial_role` | text | NOT NULL, CHECK IN ('vendedor','gestor_comercial','dono_empresa'). **Derivado de `cargo`** pelo trigger `deriva_perfil_do_cargo()`. |
| `cargo` | text | NULL. **[Extensão do doc]** CHECK `perfil_do_cargo(cargo) is not null`: fundador, socio, presidente_ceo, vice_presidente, diretor, coordenador, supervisor, gerente, vendedor. Mesmos rótulos do campo Cargo Newsletter do ActiveCampaign. |
| `role` | text | NOT NULL, default `'user'`, CHECK IN ('user','content_admin','audience_manager','admin') |
| `is_internal` | boolean | NOT NULL, default `false`. **[Extensão do doc]** Conta da equipe: papel diferente de `user` **ou** e-mail `@thiagoconcer.com.br`. Materializada pelo trigger `marca_conta_interna()` porque entra no WHERE de todos os relatórios. Fica fora do painel e da lista de leads; nada é apagado, e a ficha da pessoa continua abrindo. |
| `created_at` | timestamptz | NOT NULL, default `now()` |
### `limites_de_uso` **[Extensão do doc]**

Teto de buscas por pessoa. O acervo transcrito é o ativo do produto e a busca é a única porta por onde ele sai (6 trechos por chamada); sem freio, cerca de mil buscas automatizadas extraem o acervo inteiro e ainda consomem a API paga.

| Coluna | Tipo | Regra |
|---|---|---|
| `papel` | text | PK. Hoje só `'user'`. |
| `buscas_por_hora` | int | NOT NULL. Padrão 30. |
| `buscas_por_dia` | int | NOT NULL. Padrão 150. |
| `atualizado_em` | timestamptz | NOT NULL, default `now()`. |

**RLS:** SELECT liberado a `authenticated` (a pessoa pode saber quanto ainda pode buscar). Escrita: ninguém pelo frontend, só `service_role`.

A aplicação do limite fica **dentro da RPC `search_videos`**, não só na Edge Function: quem estiver logado pode chamar a RPC direto com o próprio JWT, e conferir só na borda protegeria o caminho do app deixando o outro aberto. Staff é ilimitado, porque a equipe testa o produto o dia inteiro.

**Índices:** PK em `id`; `idx_profiles_commercial_role` em `commercial_role`; parcial `idx_profiles_is_internal` em `is_internal` where `is_internal`; `idx_profiles_cargo` em `cargo`; `idx_profiles_role` em `role`.

### `leads`
Registro do lead gerado no cadastro e o estado de envio para a régua de nutrição.
| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `profile_id` | uuid | FK → `profiles.id`, NOT NULL |
| `full_name` | text | NOT NULL |
| `email` | text | NOT NULL |
| `whatsapp` | text | NOT NULL |
| `commercial_role` | text | NOT NULL. Derivado de `cargo`. |
| `cargo` | text | NULL. **[Extensão do doc]** Mesmo domínio de `profiles.cargo`. |
| `nurture_status` | text | NOT NULL, default `'pending'`, CHECK IN ('pending','sent','failed') |
| `nurture_sent_at` | timestamptz | NULL |
| `created_at` | timestamptz | NOT NULL, default `now()` |
**Origem [Extensão do doc]:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer` e `landing_page`, todas NULL. Capturadas na **primeira visita** (primeiro toque) e guardadas no navegador até o cadastro, porque a pessoa chega com o UTM na landing e se cadastra páginas depois, quando o parâmetro já saiu da URL. A leitura sai da função `origem_do_lead`, nunca do campo cru.

**Índices:** PK; `idx_leads_profile_id` em `profile_id`; `idx_leads_nurture_status` em `nurture_status`; `idx_leads_commercial_role` em `commercial_role`; `idx_leads_cargo` em `cargo`.

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
| `failure_reason` | text | CHECK IN ('sem_legenda','erro'), nulo fora de `failed`. Gravado por `transcribe-videos`: `sem_legenda` = o YouTube não tem legenda (retentar não resolve), `erro` = a esteira quebrou (investigar). Antes o painel adivinhava isso pela duração do vídeo. |
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
**Índices:** PK; `idx_video_segments_video_id` em `video_id`; índice vetorial `idx_video_segments_embedding` do tipo `hnsw` sobre `embedding` (cosine). Era `ivfflat` e foi trocado em 12/08/2026: o ivfflat treina os centroides na criação, e o índice nascia com a tabela vazia.

### `searches`
Cada busca de dor/tema feita por um usuário cadastrado — alimenta a segmentação de audiência.
| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `profile_id` | uuid | FK → `profiles.id`, NOT NULL |
| `query_text` | text | NOT NULL |
| `detected_topics` | text[] | NULL |
| `action_plan` | text | NULL |
| `context_question` | text | NULL. **[Extensão do doc]** Pergunta gerada a partir da dor e dos trechos, para refinar o plano. |
| `context_options` | text[] | NULL. **[Extensão do doc]** Respostas sugeridas, geradas junto com a pergunta. |
| `context_answer` | text | NULL. **[Extensão do doc]** O que a pessoa respondeu (opções clicadas e/ou texto livre). |
| `context_answered_at` | timestamptz | NULL. **[Extensão do doc]** |
| `plan_has_context` | boolean | NOT NULL, default `false`. **[Extensão do doc]** true quando o plano gravado nasceu já com a resposta. Sem ela o relatório não separa plano refinado de plano original. |
| `created_at` | timestamptz | NOT NULL, default `now()` |
**Índices:** PK; `idx_searches_profile_id` em `profile_id`; `idx_searches_created_at` em `created_at`; GIN `idx_searches_detected_topics` em `detected_topics`; parcial `idx_searches_contexto_respondido` em `created_at` where `context_answer is not null` (os relatórios de contexto só olham as respondidas, que são a minoria).

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
| `videos_failed` | int | NOT NULL, default `0`. Falhas de verdade. É o que decide se o painel pinta a mensagem de vermelho. |
| `videos_sem_legenda` | int | NOT NULL, default `0`. Vídeos que o YouTube não legenda: recado, não falha. |
| `error_message` | text | NULL. Erros reais na íntegra; os sem legenda entram resumidos numa linha, para não estourar o teto de 1000 caracteres e apagar as falhas seguintes. |
| `started_at` | timestamptz | NOT NULL, default `now()` |
| `finished_at` | timestamptz | NULL |
**Índices:** PK; `idx_ingestion_runs_status` em `status`; `idx_ingestion_runs_started_at` em `started_at`.

---

## 2. RLS e autenticação

**Autenticação:** Supabase Auth com **e-mail + senha** e **magic link** habilitados. O magic link reduz atrito no cadastro (o objetivo primário é gerar lead). O trigger `handle_new_user` cria a linha em `profiles` no signup. O papel (`role`) padrão é `user`; papéis internos (`content_admin`, `audience_manager`) são atribuídos manualmente pela equipe Concer.

RLS **ligado em todas as tabelas**. Função auxiliar `is_concer_staff()` retorna true se o `role` do usuário for `content_admin`, `audience_manager` ou `admin`.

**Papel `admin` (administrador do sistema). [Extensão do doc]** Enxerga os dois painéis e é o único que altera o `role` de alguém, pelas RPCs `get_equipe()` e `definir_papel()`.

> ⚠️ **Falha corrigida em 05/08/2026.** A regra "profiles UPDATE: dono ou staff" está certa para nome e WhatsApp, mas deixava a coluna `role` editável pelo próprio usuário: qualquer cadastrado fazia `PATCH` em `profiles.role`, virava staff e passava a ler a tabela `leads` inteira (nome, e-mail e WhatsApp de todos os leads). RLS é por linha, não por coluna, então a correção é o trigger `protege_papel_do_profile()`, que bloqueia mudança de `role` por quem não é `admin`. O dono segue editando os próprios dados normalmente.

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | dono (`id = auth.uid()`) ou staff | via trigger no signup | dono ou staff | ninguém (só service_role) |
| `leads` | staff | somente `service_role` (Edge Function no cadastro) | `service_role` (atualiza nurture_status) | ninguém |
| `videos` | qualquer usuário autenticado (SELECT) | `service_role` (ingestão) | `service_role`; staff pode marcar revisão | `service_role` |
| `video_segments` | ninguém pelo frontend — acesso só via RPC `search_videos` (SECURITY DEFINER) | `service_role` | `service_role` | `service_role` |
| `searches` | dono (`profile_id = auth.uid()`) ou staff | dono (`profile_id = auth.uid()`) | ninguém | ninguém |
| `search_results` | dono da busca associada ou staff | `service_role`/RPC | ninguém | ninguém |
| `ingestion_runs` | staff | `service_role` | `service_role` | ninguém |
| `cta_clicks` | staff | dono (`profile_id = auth.uid()`) | ninguém | ninguém |
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
- **`eh_conta_interna(email, role)`** / **`marca_conta_interna()`** (trigger) / **`perfil_interno(p_profile_id)`** — a regra de conta interna em um lugar só. A primeira decide, o trigger materializa em `profiles.is_internal`, a terceira serve as tabelas que só têm `profile_id` (leads, searches, video_views). **[Extensão do doc]**
- **`get_leads_facetas()`** (SECURITY DEFINER, staff-only) — o que existe para filtrar na lista de leads, com contagem: origens, cargos, temas buscados e situação na régua. Origem é aberta (qualquer `utm_source`, qualquer domínio de referrer), então a tela não pode ter uma lista fixa: um canal novo ficaria invisível justamente na semana em que começou a trazer gente. **[Extensão do doc]**
- **`get_lead_detail(p_profile_id)`** passou a devolver o bloco `origem` com as UTMs **como foram capturadas** (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, `landing_page`), além da origem derivada. O relatório de captação continua usando a derivada, que é a leitura certa para comparar canais; na ficha de uma pessoa a pergunta é operacional (de qual anúncio, de qual link), e aí a derivada esconde o que interessa. **[Extensão do doc]**
> **ActiveCampaign, inscrição na lista (21/08/2026).** O `contact/sync` cria o contato, mas contato **sem lista** não entra em campanha nenhuma: a régua continua funcionando (a automação dispara por tag), e qualquer disparo pontual passa por cima da pessoa em silêncio. Descoberto quando o e-mail de aviso da falha alcançava 9 de 15 cadastrados. O `_shared/activecampaign.ts` passou a inscrever na lista (`AC_LIST_ID`, padrão 3) logo depois do sync, pulando quem cancelou inscrição, que é a única coisa ali que não se conserta depois.

### `email_events` **[Extensão do doc]**
Envios e cliques das campanhas `[CF]` no ActiveCampaign, sincronizados por `sync-email-events`.
| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | uuid | PK |
| `profile_id` | uuid | FK → `profiles.id`, NULL quando o contato do AC não tem conta no produto |
| `ac_contact_id` | text | NOT NULL |
| `email` | text | NOT NULL |
| `campaign_id` / `campaign_name` / `message_id` | text | identificam o e-mail |
| `tipo` | text | NOT NULL, CHECK IN ('enviado','clique') |
| `link_url` | text | NULL nos envios; nos cliques, o link clicado |
| `ocorrido_em` | timestamptz | NOT NULL |
**Índices:** PK; único `idx_email_events_unico` em (`ac_contact_id`,`campaign_id`,`tipo`,`link_url`,`ocorrido_em`) **NULLS NOT DISTINCT**, que é o que torna a sincronização idempotente e o que o upsert declara no ON CONFLICT (índice por expressão não casa com ON CONFLICT); mais `profile_id`, `ocorrido_em` e `campaign_id`.

**Por que só envio e clique:** a API do ActiveCampaign entrega envio por contato (`logs`) e clique por contato (`links/{id}/linkData`), mas **abertura por campanha não existe** por contato, só o total. O que dá para saber de abertura vem agregado em `email_contatos`.

### `email_contatos` **[Extensão do doc]**
Agregados do contato no ActiveCampaign: `enviados_na_conta` (todas as campanhas da conta, não só as do ConcerFinder), `ultimo_open`, `ultimo_clique`, `bounce`. Responde "essa pessoa lê e-mail?" sem varrer eventos.

- **`get_email_insights(from_date, to_date, filter_commercial_role)`** (SECURITY DEFINER, staff-only) — funil de cada e-mail da régua (receberam x clicaram), o convite do parceiro somando as duas portas (plano de ação e e-mail) contando pessoas e não cliques, e a lista de quem clicou no e-mail e nunca buscou. **[Extensão do doc]**
- **`get_busca_detail(p_search_id)`** (SECURITY DEFINER, staff-only) — o que a pessoa recebeu numa busca: pergunta de contexto, resposta, plano inteiro e os trechos na ordem entregue, marcando quais ela abriu. Separada de `get_lead_detail` porque é lida uma busca por vez; trazer o plano de todas junto pesaria a ficha inteira. **[Extensão do doc]**
- **`get_contexto_insights(from_date, to_date, filter_commercial_role)`** (SECURITY DEFINER, staff-only) — quantos respondem a pergunta de contexto, por perfil, e trechos abertos por busca com e sem contexto. **[Extensão do doc]**
- **`get_audience_insights()`** (SECURITY DEFINER, staff-only) — agrega `searches.detected_topics` × `profiles.commercial_role` para o painel de audiência.
- **`get_search_results(p_search_id)`** (SECURITY DEFINER) — reabre os resultados de uma busca anterior em `/busca/historico`.
- **`get_video_detail(p_video_id)`** (SECURITY DEFINER) — metadados do vídeo e os trechos que o usuário já recuperou, para `/video/:id`.
- **`get_content_dashboard()`** (SECURITY DEFINER, staff-only) — contadores da esteira para `/admin/conteudo`.
- **`run_ingestion_step(step)`** (SECURITY DEFINER, interna) — o `pg_cron` usa para chamar as Edge Functions da esteira com o segredo guardado no Vault.

---

## 4. Páginas do frontend

- **`/`** (`landing`) — apresentação: explica que o usuário descreve qualquer dor de vendas e encontra onde o Concer fala sobre ela; CTA para cadastro.
- **`/cadastro`** (`sign-up`) — formulário de cadastro (nome, e-mail, WhatsApp, **cargo**) que gera lead e libera a busca. O perfil comercial não é mais perguntado: sai do cargo. **[Extensão do doc]**
- **`/login`** (`login`) — login por senha ou magic link para usuários já cadastrados.
- **`/busca`** (`search`) — caixa onde o usuário descreve a dor em linguagem natural; exibe recomendações com vídeo, minutagem exata e plano de ação. Protegida (só autenticado).
- **`/busca/historico`** (`search-history`) — histórico de buscas do próprio usuário e novas explorações por tema.
- **`/video/:id`** (`video-detail`) — abre o vídeo no minuto do insight (deep-link para o YouTube no timestamp).
- **`/admin/conteudo`** (`admin-content`) — painel do admin de conteúdo: status de scraping/transcrição/indexação por vídeo e `ingestion_runs`. Staff-only.
- **`/admin/dashboard`** (`admin-dashboard`) — painel agregado: crescimento, funil de ativação, qualidade da busca, temas/dores, cargos, rankings de trechos e acervo ocioso. Staff-only. O filtro de perfil vale para a tela inteira. **[Extensão do doc]**
- **`/admin/leads`** (`admin-leads`) — tabela de pessoas: **score (0-100)**, contato, cargo, etapa da régua, buscas, palavras buscadas e último acesso. A lista vem ordenada por score, que é o que faz um "top 100" significar alguma coisa. Staff-only. **[Extensão do doc]**
- **`/admin/leads/:id`** (`admin-lead-perfil`) — ficha da pessoa: **score com as parcelas abertas** (cargo, atividade, recência, foco), buscas com temas, trechos abertos e posição na régua. Rota própria para ser linkável do histórico e do painel. Staff-only. **[Extensão do doc]**
- **`/admin/audiencia`** — rota antiga, redireciona para `/admin/dashboard`.

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
