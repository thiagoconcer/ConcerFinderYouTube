# Functions & Endpoints — ConcerFinder

> **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions Deno + Realtime + pg_cron).
> **Convenções:** Edge Functions em **kebab-case**, invocadas via `supabase.functions.invoke(...)` (cliente React) ou por webhook externo. Postgres Functions em **snake_case**, chamadas via `supabase.rpc(...)`, por trigger de tabela ou por agendamento `pg_cron`.
> **Padrão de autenticação:** funções que gravam em `leads`, `videos`, `video_segments`, `search_results` e `ingestion_runs` rodam com **`service_role`** (chave nunca exposta no frontend — só dentro da Edge Function). Funções de leitura de vídeos exigem **usuário logado**. Painéis internos exigem **staff** (`is_concer_staff()`).
>
> Todas as functions abaixo estão listadas na ESTRUTURA. Onde eu precisei acrescentar detalhe de validação para cumprir uma regra do PROCESSO, sinalizo com **[Extensão do doc]**.

---

## Edge Functions

### `register-lead`
- **Propósito:** concluir o cadastro do visitante, gerar o lead e dispará-lo para a régua de nutrição (e-mail via ActiveCampaign + WhatsApp) através do webhook existente (Make / N8N).
- **Autenticação exigida:** **usuário logado** (chamada logo após o signup do Supabase Auth, com JWT válido do usuário recém-criado). A função usa `service_role` internamente para escrever em `leads`.
- **Input (body JSON):**
  ```json
  {
    "profile_id": "uuid",
    "full_name": "string",
    "email": "string",
    "whatsapp": "string",
    "commercial_role": "vendedor | gestor_comercial | dono_empresa"
  }
  ```
- **Output:**
  ```json
  {
    "lead_id": "uuid",
    "nurture_status": "sent | pending | failed",
    "message": "Cadastro concluído. Busca liberada."
  }
  ```
- **Regras de negócio / validações:**
  - Confere que `profile_id === auth.uid()` do JWT (impede gerar lead em nome de terceiro). **[Extensão do doc]**
  - Valida `commercial_role` contra `('vendedor','gestor_comercial','dono_empresa')`; rejeita valor fora da lista.
  - Valida formato de `email` e presença de `whatsapp` (ambos obrigatórios para a nutrição — Regra: "todo cadastro concluído gera lead e entra na régua").
  - Faz **upsert** em `profiles` (garante consistência caso o trigger `handle_new_user` ainda não tenha rodado) e **insere** em `leads` com `nurture_status='pending'`.
  - Dispara o **webhook de nutrição** (Make → ActiveCampaign + WhatsApp / fluxo N8N existente). Em sucesso: `nurture_status='sent'` + `nurture_sent_at=now()`. Em falha do webhook: `nurture_status='failed'` (não bloqueia o cadastro; a busca é liberada mesmo assim). **[Extensão do doc]**
  - Idempotência: se já existir `lead` para o `profile_id`, não duplica — apenas retorna o existente.

---

### `scrape-youtube-channel`
- **Propósito:** capturar a lista de vídeos do canal do Thiago Concer e fazer upsert na tabela `videos` para posterior transcrição/indexação.
- **Autenticação exigida:** **admin (staff `content_admin`)** quando chamada manualmente pelo painel `/admin/conteudo`; **service_role** quando disparada pelo `pg_cron`.
- **Input (body JSON, opcional):**
  ```json
  {
    "channel_id": "string (default: canal do Concer)",
    "force_full": false
  }
  ```
- **Output:**
  ```json
  {
    "run_id": "uuid",
    "videos_found": 0,
    "videos_new": 0,
    "status": "completed | failed"
  }
  ```
- **Regras de negócio / validações:**
  - Abre um registro em `ingestion_runs` com `run_type='scrape'`, `status='running'`; ao final grava `videos_processed`, `finished_at` e `status`.
  - Consulta a **YouTube Data API v3**; usa **Apify** como fallback/enriquecimento quando a API não cobrir metadados ou legendas.
  - Faz **upsert** em `videos` pela chave única `youtube_video_id`; vídeos novos entram com `transcription_status='pending'`.
  - Não reprocessa vídeos já `indexed` a menos que `force_full=true`.
  - Regra do PROCESSO: "novos vídeos publicados no canal devem ser incorporados à base" — garantida pela execução diária via cron.
  - Em erro, grava `error_message` no `ingestion_runs` e retorna `status='failed'`.

---

### `transcribe-videos`
- **Propósito:** transcrever o áudio dos vídeos pendentes e quebrar o texto em `video_segments` com janelas de tempo (base da minutagem exata).
- **Autenticação exigida:** **service_role** (cron + gatilho pós-scrape) ou **admin** para reprocessar um vídeo específico pelo painel.
- **Input (body JSON, opcional):**
  ```json
  {
    "video_id": "uuid (opcional; se ausente, processa lote de pending)",
    "batch_size": 10
  }
  ```
- **Output:**
  ```json
  {
    "run_id": "uuid",
    "videos_transcribed": 0,
    "segments_created": 0,
    "videos_failed": 0,
    "videos_sem_legenda": 0,
    "status": "completed | failed"
  }
  ```
- **Regras de negócio / validações:**
  - Seleciona vídeos com `transcription_status='pending'` (limitado por `batch_size` para controlar custo/tempo de execução da Edge Function). **[Extensão do doc]**
  - Marca cada vídeo como `transcribing` antes de começar (evita corrida entre execuções concorrentes do cron). **[Extensão do doc]**
  - Chama a **API de STT (OpenAI Whisper)** para gerar o texto e os timestamps.
  - Divide a transcrição em `video_segments` preenchendo `segment_text`, `start_seconds`, `end_seconds` e (opcionalmente) `topic_tags`.
  - Ao concluir, atualiza `videos.transcription_status='transcribed'`; em falha, `='failed'` com log em `ingestion_runs (run_type='transcribe')`.

---

### `index-segments`
- **Propósito:** gerar os embeddings vetoriais de cada segmento transcrito, habilitando a busca semântica.
- **Autenticação exigida:** **service_role** (cron + gatilho pós-transcrição).
- **Input (body JSON, opcional):**
  ```json
  {
    "video_id": "uuid (opcional)",
    "batch_size": 100
  }
  ```
- **Output:**
  ```json
  {
    "run_id": "uuid",
    "segments_indexed": 0,
    "videos_indexed": 0,
    "status": "completed | failed"
  }
  ```
- **Regras de negócio / validações:**
  - Seleciona vídeos com `transcription_status='transcribed'` e seus `video_segments` sem `embedding`.
  - Gera embedding com **OpenAI `text-embedding-3-small` (1536 dims)** — mesma dimensão do índice `vector(1536)`; rejeita/pula segmentos vazios. **[Extensão do doc]**
  - Grava o `embedding` no segmento; quando todos os segmentos do vídeo estiverem vetorizados, marca `videos.transcription_status='indexed'` e preenche `indexed_at`.
  - Registra `ingestion_runs (run_type='index')`.
  - Regra: só vídeos `indexed` participam da busca (a RPC `search_videos` só encontra segmentos com embedding).

---

### `search-pain`
- **Propósito:** receber a dor em linguagem natural, gerar o embedding da consulta e chamar a RPC `search_videos`, devolvendo os trechos com a minutagem exata. **[Extensão do doc]**
- **Por que existe:** a RPC `search_videos` recebe o `query_embedding` já pronto, mas a chave da API de embeddings não pode chegar ao navegador (gate de segurança do `SKILL.md`). O embedding da consulta precisa ser gerado no servidor, e o `SKILL.md` já previa uma Edge Function `search-pain` nesse ponto do fluxo.
- **Autenticação exigida:** **usuário logado**. A RPC é chamada com o **JWT do próprio usuário**, não com `service_role`, para que `auth.uid()` seja o dele e a busca fique gravada no perfil certo.
- **Input (body JSON):**
  ```json
  { "query_text": "string", "match_count": 6 }
  ```
- **Output:**
  ```json
  {
    "search_id": "uuid",
    "query_text": "string",
    "detected_topics": ["objecao-de-preco"],
    "results": [{ "video_id": "uuid", "youtube_video_id": "string", "title": "string", "segment_id": "uuid", "segment_text": "string", "start_seconds": 0, "similarity_score": 0.0, "rank_position": 1 }],
    "total": 0
  }
  ```
- **Regras de negócio / validações:**
  - Exige `query_text` entre 10 e 2000 caracteres; abaixo disso a busca semântica não tem sinal suficiente.
  - Gera `detected_topics` pela taxonomia de dores de vendas em pt-BR e repassa à RPC, alimentando a segmentação de audiência.
  - Não persiste nada por conta própria: quem grava `searches` e `search_results` é a RPC `search_videos`.

---

### `context-question`

**[Extensão do doc]** Gera a pergunta que o sistema faz depois de entregar os trechos, para o plano ser escrito para o caso da pessoa e não para o caso médio.

- **Propósito:** a partir da dor descrita e dos trechos recuperados, produzir UMA pergunta (com 2 a 4 respostas sugeridas) cuja resposta mudaria o plano.
- **Autenticação exigida:** **usuário logado**, e a busca precisa ser dele.
- **Input (body JSON):**
  ```json
  {
    "search_id": "uuid",
    "top_segments": [{ "title": "string", "segment_text": "string", "start_seconds": 0 }]
  }
  ```
- **Output:**
  ```json
  {
    "search_id": "uuid",
    "question": "string ou null",
    "options": ["string"],
    "answered": false
  }
  ```
- **Regras de negócio / validações:**
  - **Por que é função separada do `search-pain`:** a busca é o momento em que a pessoa está olhando a tela esperando os trechos. Somar outra chamada de LLM ali atrasaria a entrega para todo mundo, inclusive para quem nunca vai responder. O frontend dispara esta função **em paralelo** com o `generate-action-plan`, depois que os trechos já apareceram.
  - **Por que a pergunta é gerada e não fixa:** um formulário perguntaria a mesma coisa para "o cliente some depois da proposta" e para "não passo da secretária", e nos dois casos perguntaria o que não muda o plano. Aqui ela nasce da dor **e** dos trechos, porque o que se quer saber é como aplicar aqueles vídeos naquele caso.
  - **Pode não perguntar nada:** dor já detalhada, busca sem trecho relevante ou falha na chamada devolvem `question: null`, e a tela simplesmente não mostra a caixa. Nada aqui pode segurar o plano.
  - Idempotente: a pergunta de uma busca é gerada uma vez (`searches.context_question`); recarregar a tela devolve a mesma.
  - Effort `low` e saída de duas linhas, porque ela precisa aparecer antes do plano.

---

### `sync-email-events`

**[Extensão do doc]** Traz do ActiveCampaign o que a régua provocou: quem recebeu cada e-mail e quem clicou em qual link.

- **Autenticação:** staff, service_role ou `X-Cron-Secret` (`requireStaffOrService`).
- **Agenda:** `cron_email_events`, de 6 em 6 horas. Durante um lançamento a régua dispara o dia inteiro, e clique que só aparece no dia seguinte chega tarde para virar ligação.
- **Fontes na API:** `logs?filters[campaignid]=` (envio por contato), `campaigns/{id}/links` + `links/{id}/linkData` (clique por contato, com link) e os campos do contato (`last_open_date`, `last_click_date`, `sentcnt`, bounce).
- **Regras:**
  - Só campanhas cujo nome começa com `[CF]`, filtradas pelo nome na API. A conta tem 191 campanhas e as do ConcerFinder não cabem nas primeiras 100 de nenhuma ordenação.
  - Contato do AC sem conta no produto é ignorado: o painel contaria gente que nunca entrou.
  - Idempotente pelo índice único de `email_events`; rodar de novo no mesmo período não duplica nada.
  - **Abertura por campanha não é sincronizada porque a API não expõe.** O que existe de abertura é o agregado por contato, gravado em `email_contatos` com o nome dizendo que é da conta inteira.

---

### `generate-action-plan`
- **Propósito:** gerar o texto do plano de ação a partir da dor descrita pelo usuário e dos top segmentos recuperados na busca.
- **Autenticação exigida:** **usuário logado** (chamada dentro do fluxo de busca; o JWT do usuário é validado).
- **Input (body JSON):**
  ```json
  {
    "search_id": "uuid",
    "query_text": "string",
    "top_segments": [
      { "video_id": "uuid", "segment_text": "string", "start_seconds": 0 }
    ]
  }
  ```
- **Output:**
  ```json
  {
    "search_id": "uuid",
    "action_plan": "string (passos práticos ancorados nos insights dos vídeos)"
  }
  ```
- **Regras de negócio / validações:**
  - Valida que a `search` pertence ao usuário logado (`searches.profile_id = auth.uid()`) antes de gravar. **[Extensão do doc]**
  - Chama o LLM **Claude Opus 5** (contexto de 1M tokens, consolida vários trechos; alternativa custo-eficiente **Claude Sonnet 5** para pico de buscas, via secret `ANTHROPIC_MODEL`).
  - Trata `stop_reason: "refusal"` antes de ler o conteúdo e usa o fallback de servidor do Claude, que reexecuta a chamada em outro modelo em vez de devolver a recusa. **[Extensão do doc]**
  - O plano é construído **apenas** a partir dos segmentos recuperados (Regra/Suposição: o plano deriva dos próprios insights dos vídeos relacionados à dor). **Uma exceção declarada:** a quinta seção, `## Como a IA acelera isso`, tem fonte própria (`_shared/viverdeia.ts`) e não sai dos trechos.
  - **Seção de parceiro [Extensão do doc]:** o modelo escolhe uma ou duas famílias de solução do Viver de IA de uma **lista fechada**, e não pode inventar produto, integração ou funcionalidade fora dela; sem a lista ele criaria uma solução plausível que o parceiro não tem, e a pessoa cairia no formulário procurando algo que ninguém vende. O prompt carrega junto a régua editorial da parceria: nada de contar quantas soluções existem (usa "dezenas de soluções prontas"), nada de preço, promessa de resultado ou "a IA substitui vendedor", e a IA nunca aparece criando processo ou disciplina que a empresa não tem. Quem escreve a chamada para ação é a tela, não o modelo.
  - **Refinamento por contexto [Extensão do doc]:** quando o corpo traz `context_answer` (a resposta à pergunta do `context-question`), o plano é gerado de novo, agora com o caso concreto da pessoa, e grava `context_answer`, `context_answered_at` e `plan_has_context = true`. É **uma** regeração por busca: sem essa trava, cada reenvio do formulário (duplo clique, voltar de um vídeo) pagaria outra chamada de LLM. No modo interno (`force`), o contexto usado é o que já está gravado na busca.
  - Persiste o resultado em `searches.action_plan` (via `service_role`).
  - Se não houver segmentos relevantes (nenhum resultado), retorna um `action_plan` indicando que não foram encontrados trechos e sugere refinar a dor. **[Extensão do doc]**

---

### `nurture-status`

**[Extensão do doc]** Devolve em que etapa da régua cada pessoa está, para o painel de leads.

| | |
|---|---|
| Método | `POST` |
| Auth | staff (JWT) ou `service_role` / `X-Cron-Secret` |
| Entrada | nenhuma |
| Saída | `{ disponivel, total, situacoes: { <email>: { fluxo, etapa, rotulo } } }` |

Busca **por tag**, não por contato: perguntar as tags de cada lead custaria uma chamada por pessoa, e com a base grande a página não abriria. São 7 chamadas fixas (3 tags de fluxo + 4 de etapa), independentemente do tamanho da base.

Falha do ActiveCampaign devolve `disponivel: false`, nunca 500: a lista de leads é dado nosso e continua útil sem a coluna de nutrição.

### `sync-nurture`
- **Propósito:** empurrar o lead para o ActiveCampaign com a personalização real: a dor que a pessoa escreveu, os temas detectados e o link do trecho no minuto exato. **[Extensão do doc]**
- **Por que existe:** a API do ActiveCampaign **não permite criar automação nem campanha** (`405` nas duas). A régua é montada na interface e disparada por tag; esta função é quem preenche os campos personalizados e aplica a tag no momento certo.
- **Autenticação exigida:** usuário logado (sincroniza o próprio perfil) ou chamada interna com `X-Cron-Secret`/`service_role` (aí aceita `profile_id`).
- **Input (body JSON):**
  ```json
  { "profile_id": "uuid (só no modo interno)", "aplicar_gatilho": false }
  ```
- **Regras de negócio / validações:**
  - **A tag de gatilho só entra depois da primeira busca.** No cadastro ainda não existe dor para contar, e o primeiro e-mail sairia sem justamente aquilo que diferencia o ConcerFinder. Por isso `register-lead` chama com `aplicar_gatilho: false` e `search-pain` chama com `true`.
  - Os campos personalizados são gravados **antes** da tag de gatilho: o AC dispara a automação no instante em que a tag entra.
  - Ids de campo e de tag são resolvidos em runtime pelo nome, não fixados no código, para sobreviver a renomeação no AC.
  - Idempotente: `contact/sync` faz upsert por e-mail e tag repetida não é erro.
  - Falha de sincronização **não bloqueia** o cadastro nem a busca: o acesso é o que o usuário está esperando naquele instante.

---

### `nurture-webhook-callback`
- **Propósito:** receber do Make/N8N o status de entrega da régua de nutrição e atualizar o lead correspondente.
- **Autenticação exigida:** **webhook externo com validação HMAC** (assinatura no header, segredo compartilhado) — não usa JWT de usuário. **[Extensão do doc]**
- **Input (body JSON):**
  ```json
  {
    "lead_id": "uuid",
    "delivery_status": "sent | failed",
    "channel": "email | whatsapp",
    "signature": "hmac-sha256 (via header X-Signature)"
  }
  ```
- **Output:**
  ```json
  { "ok": true, "lead_id": "uuid", "nurture_status": "sent | failed" }
  ```
- **Regras de negócio / validações:**
  - Verifica a assinatura HMAC antes de qualquer escrita; requisição sem assinatura válida → `401`.
  - Atualiza `leads.nurture_status` e, quando `sent`, `leads.nurture_sent_at`.
  - Ignora `lead_id` inexistente (retorna `200` com `ok:false` para não gerar retries infinitos no Make). **[Extensão do doc]**

---

## Postgres Functions (RPC / triggers)

### `search_videos(query_embedding vector, match_count int)`
- **Tipo:** **RPC chamável pelo client** — `SECURITY DEFINER`.
- **Propósito:** núcleo da busca semântica — encontra os trechos de vídeo mais próximos da dor descrita e persiste a busca + resultados.
- **Quando dispara:** evento HTTP via `supabase.rpc('search_videos', ...)` quando o usuário submete uma dor na caixa de busca (`/busca`). O `query_embedding` é gerado previamente (embedding da `query_text` do usuário).
- **Input:** `query_embedding vector(1536)`, `match_count int` (nº de recomendações, ex.: 5).
- **Output:** tabela com `video_id`, `youtube_video_id`, `title`, `start_seconds`, `segment_text`, `similarity_score`, `rank_position`.
- **Regras de negócio / validações:**
  - Exige `auth.uid()` válido — se nulo, aborta (Regra crítica: **visitante sem cadastro não vê recomendação**). Por ser `SECURITY DEFINER`, é a **única** via de acesso a `video_segments`, que não é lida pelo frontend.
  - Faz busca por **similaridade de cosseno** no índice vetorial de `video_segments` (apenas de vídeos `indexed`).
  - Insere um registro em `searches` (`profile_id = auth.uid()`, `query_text`, `detected_topics`) e um registro por resultado em `search_results` (com `segment_id`, `start_seconds`, `similarity_score`, `rank_position`) — cumpre a Regra: "cada dor pesquisada é registrada e associada ao perfil" (alimenta a segmentação de audiência).
  - Retorna a **minutagem exata** (`start_seconds`) usada no deep-link para o YouTube. Regra: "cada busca retorna vídeo + minutagem + plano de ação" (o plano vem em seguida via `generate-action-plan`).

---

### `handle_new_user()`
- **Tipo:** **trigger de tabela** (`AFTER INSERT` em `auth.users`), `SECURITY DEFINER`.
- **Propósito:** criar automaticamente o registro em `profiles` no momento do signup.
- **Quando dispara:** **INSERT em `auth.users`** (cadastro por e-mail+senha ou magic link).
- **Input:** `NEW` da linha inserida em `auth.users` (id, email e metadados do signup — `full_name`, `whatsapp`, `commercial_role`).
- **Output:** cria uma linha em `profiles` (`id = NEW.id`, `role='user'`); sem retorno para o client.
- **Regras de negócio / validações:**
  - Define `role='user'` por padrão; papéis internos (`content_admin`, `audience_manager`) só são atribuídos manualmente pela equipe Concer.
  - Copia `full_name`, `email`, `whatsapp`, `commercial_role` a partir dos metadados do signup; valida `commercial_role` contra o CHECK. **[Extensão do doc]**
  - Garante que exista o `profiles` antes de `register-lead` rodar (idempotente com o upsert da Edge Function).

---

### `is_concer_staff()`
- **Tipo:** **função auxiliar de RLS** (chamável internamente pelas policies; não é endpoint público).
- **Propósito:** determinar se o usuário atual é da equipe Concer, controlando acesso aos painéis e dados sensíveis.
- **Quando dispara:** avaliada dentro das **policies de RLS** (SELECT/UPDATE de `leads`, `videos`, `searches`, `ingestion_runs`) e pela RPC `get_audience_insights`.
- **Input:** nenhum (usa `auth.uid()` internamente).
- **Output:** `boolean` — `true` se `profiles.role IN ('content_admin','audience_manager')`.
- **Regras de negócio / validações:**
  - Regra: "apenas a equipe Concer acessa os painéis de gestão e os dados consolidados de leads."
  - Não pode ser burlada pelo frontend, pois é usada nas policies do banco.

---

### `get_search_results(p_search_id uuid)`
- **Tipo:** **RPC chamável pelo client** — `SECURITY DEFINER`. **[Extensão do doc]**
- **Propósito:** reabrir os resultados de uma busca anterior em `/busca/historico`.
- **Por que existe:** `video_segments` não tem policy para o frontend, então o texto do trecho de uma busca já feita só pode sair por RPC. Devolve apenas o que o usuário já viu.
- **Input:** `p_search_id uuid`.
- **Output:** as linhas de `search_results` com `segment_text`, `start_seconds`, título do vídeo e o `action_plan` da busca.
- **Regras:** aborta se `auth.uid()` for nulo; só devolve se a busca for do próprio usuário ou se `is_concer_staff()`.

---

### `get_video_detail(p_video_id uuid)`
- **Tipo:** **RPC chamável pelo client** — `SECURITY DEFINER`. **[Extensão do doc]**
- **Propósito:** alimentar `/video/:id` com os metadados do vídeo e os trechos relevantes.
- **Input:** `p_video_id uuid`.
- **Output:** `jsonb` com `video` (metadados) e `segments` (trechos com `start_seconds` e `topic_tags`).
- **Regras:** exige `auth.uid()`; devolve **apenas os segmentos que o próprio usuário já recuperou** em buscas dele (staff vê todos). Mantém a regra de que ninguém navega livremente pela transcrição.

---

### `get_content_dashboard()`
- **Tipo:** **RPC chamável pelo client** — `SECURITY DEFINER`, **staff-only**. **[Extensão do doc]**
- **Propósito:** contadores da esteira de ingestão para o painel `/admin/conteudo` (total de vídeos por `transcription_status`, segmentos, segmentos com embedding, última execução).
- **Regras:** bloqueia se `is_concer_staff()` for falso.

---

### `run_ingestion_step(step text)`
- **Tipo:** **função interna** (`SECURITY DEFINER`), chamada só pelo `pg_cron`. **[Extensão do doc]**
- **Propósito:** disparar uma etapa da esteira via `net.http_post` para a Edge Function correspondente.
- **Regras:** valida `step` contra a lista permitida; lê o segredo `concerfinder_cron_secret` do **Vault** e o envia no header `X-Cron-Secret`. `EXECUTE` revogado de `public`, `anon` e `authenticated`.

---

### `get_audience_insights()`
- **Tipo:** **RPC chamável pelo client** — `SECURITY DEFINER`, **staff-only**.
- **Propósito:** consolidar dores/temas buscados cruzados com o perfil comercial dos leads, para o painel de audiência e a monetização com empresas parceiras.
- **Quando dispara:** evento HTTP via `supabase.rpc('get_audience_insights')` na página `/admin/audiencia`.
- **Input:** filtros opcionais (`from_date`, `to_date`, `commercial_role`). **[Extensão do doc]**
- **Output:** agregações — temas mais buscados (`searches.detected_topics`) × `profiles.commercial_role`, contagem de leads por perfil, ranking de dores, e ainda **[Extensão do doc]**: `perfis_por_tema` (quem procura o quê), `trechos_mais_recomendados` (de `search_results`), `trechos_mais_assistidos` (de `video_views`) e `videos_mais_recomendados`.
- **Regras de negócio / validações:**
  - Bloqueia execução se `is_concer_staff()` for `false` (aborta com erro de permissão).
  - Somente leitura/agregação; não expõe dados individuais além do necessário para segmentação.
  - Alimenta a Regra de negócio: "usa esses dados para abordar empresas que precisam alcançar esse público" (fonte de receita descrita na ideia).

---

### `score_do_lead_detalhe(profile_id uuid)` e `score_do_lead(profile_id uuid)`
- **Tipo:** funções `STABLE`, **sem** `SECURITY DEFINER`, de propósito. **[Extensão do doc]**
- **Propósito:** responder "por quem eu começo?" com um número de 0 a 100. `score_do_lead_detalhe` guarda a regra e devolve as parcelas; `score_do_lead` é só a leitura do total, para não existirem dois cálculos.
- **Composição:** cargo 0-30 (dono 30, gestor 22, vendedor 12, sem cargo 8) + atividade 0-45 (buscas até 20, dias distintos de volta até 15, trechos abertos até 10) + recência 0-15 (7 dias 15, 30 dias 10, 90 dias 5) + foco de tema 0-10 (tema dominante em 60%+ das buscas vale 10, disperso vale 4, menos de 2 buscas vale 0).
- **Decisão:** comportamento vale 70 dos 100 pontos e cargo vale 30. Dono de empresa que se cadastra e não volta empaca em 30, e é frio. É a mesma régua do relatório de origem: quem traz volume e não ativa é tráfego, não audiência. Cargo é promessa, comportamento é prova.
- **Por que não é `SECURITY DEFINER`:** chamada de dentro de `get_leads` (que já é definer e checa staff) enxerga tudo; chamada direta por um usuário comum com o id de outra pessoa esbarra na RLS e calcula sobre zero linha. O score não vira janela para o comportamento alheio.
- **Consumidores:** `get_leads`, `get_lead_detail` e a view `analytics.fato_leads`. Uma regra só para painel e data lake, pelo mesmo motivo de `origem_do_lead`.

---

### `faixa_do_score(score int)`
- **Tipo:** função `IMMUTABLE`. **[Extensão do doc]**
- **Propósito:** traduzir o número em `quente` (70+), `morno` (40-69) ou `frio`. Existe para painel e data lake usarem o mesmo corte: dois "quente" diferentes seria a divergência que a função única evita.

---

## Agendamentos pg_cron (orquestração da ingestão)

Cadeia diária que garante a Regra "novos vídeos entram na base automaticamente":

| Job | Função disparada | Frequência configurada |
|---|---|---|
| `cron_scrape_channel` | `run_ingestion_step('scrape-youtube-channel')` | `0 6 * * *` (03:00 em Brasília) |
| `cron_transcribe` | `run_ingestion_step('transcribe-videos')` | `30 6 * * *` (03:30 em Brasília) |
| `cron_index` | `run_ingestion_step('index-segments')` | `0 7 * * *` (04:00 em Brasília) |

> Cada etapa só processa o que a anterior deixou pronto (`pending → transcribed → indexed`), garantindo idempotência mesmo que uma execução falhe no meio.
>
> **Autenticação do cron:** os jobs **não** usam a `service_role`. Usam um segredo dedicado (`CRON_SECRET`), guardado no **Vault** do Postgres e publicado nos Secrets das Edge Functions, enviado no header `X-Cron-Secret`. Se esse segredo vazar, ele abre só as três rotas de ingestão, não o banco inteiro. Por isso as três funções têm `verify_jwt = false` no `config.toml`: a autenticação acontece dentro da função (`requireStaffOrService`), que aceita JWT de staff, `service_role` ou o `X-Cron-Secret`, e devolve 401 para qualquer outra coisa.
