# SETUP: o que falta para o ConcerFinder rodar de ponta a ponta

> Todo o código, o banco, as Edge Functions e a agenda do cron já estão no ar.
> O que falta são **chaves de API de serviços externos**, que só você pode criar.
> Enquanto elas não existirem, cada função devolve um erro claro dizendo qual chave falta,
> em vez de quebrar.

Onde configurar: **Supabase → Project Settings → Edge Functions → Secrets**
(https://supabase.com/dashboard/project/lzjwiibsqbowrrekptvg/settings/functions)

Depois de salvar os secrets **não precisa republicar nada**: as funções leem no runtime.

---

## Obrigatórias para a busca funcionar

| Secret | Onde pegar | O que quebra sem ela |
|---|---|---|
| `OPENAI_API_KEY` | platform.openai.com → API keys | `search-pain` e `index-segments`. Sem ela não há embedding, logo não há busca semântica. |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys | `generate-action-plan`. A busca ainda devolve os vídeos e a minutagem, mas sem o plano de ação. |

> **Por que a chave da OpenAI não pôde ser substituída pela do Claude:** a Anthropic não oferece API de embeddings. A API do Claude expõe Messages, Batches, Files, Token Counting e Models, e nenhum endpoint de vetorização. O `pgvector` precisa de vetores de 1536 dimensões, e quem os gera é o `text-embedding-3-small` da OpenAI. O Claude cobre a parte de geração de texto (o plano de ação), que é onde ele é melhor mesmo.

## Obrigatórias para a ingestão dos vídeos

| Secret | Onde pegar | O que quebra sem ela |
|---|---|---|
| `YOUTUBE_API_KEY` | console.cloud.google.com → APIs → YouTube Data API v3 | `scrape-youtube-channel`. Sem ela a base fica vazia. |
| `YOUTUBE_CHANNEL_ID` | o ID do canal do Concer, no formato `UC...` | idem. Dá para descobrir em youtube.com/@thiagoconcer → ver código-fonte, ou pela própria API. |

## Opcionais (melhoram ou completam o fluxo)

| Secret | Para quê |
|---|---|
| `APIFY_TOKEN` | Fallback de transcrição. A primeira tentativa é a legenda pública do YouTube, que é grátis; o Apify cobre os vídeos sem legenda ativada. |
| `APIFY_TRANSCRIPT_ACTOR` | Trocar o actor de transcrição do Apify. Padrão: `topaz_sharingan~Youtube-Transcript-Scraper-1`. |
| `AUDIO_SOURCE_URL` | Último recurso de transcrição, via Whisper. Deve ser uma URL com `{video_id}` que devolva o áudio do vídeo. Precisa de `OPENAI_API_KEY`. |
| `ANTHROPIC_MODEL` | Trocar o modelo do plano de ação. Padrão: `claude-opus-5`. Em pico de buscas, `claude-sonnet-5` sai mais barato e responde mais rápido. |
| `ANTHROPIC_EFFORT` | Profundidade de raciocínio do plano: `low`, `medium` (padrão), `high`, `xhigh` ou `max`. Baixar reduz latência e custo; subir melhora planos para dores mais complexas. |
| `NURTURE_WEBHOOK_URL` | URL do webhook do N8N que dispara a régua (ActiveCampaign + WhatsApp). Sem ela o lead é criado com `nurture_status='pending'` e nada é disparado. |
| `NURTURE_WEBHOOK_TOKEN` | Bearer token, se o seu webhook do N8N exigir autenticação. |
| `NURTURE_WEBHOOK_SECRET` | Segredo compartilhado do HMAC-SHA256 do `nurture-webhook-callback`, que o N8N usa para reportar o status de entrega. |

## Já configurada automaticamente

| Secret | Observação |
|---|---|
| `CRON_SECRET` | Gerado e publicado durante o setup. Também está no Vault do Postgres (`concerfinder_cron_secret`), que é de onde o `pg_cron` lê. Não precisa mexer. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Injetadas pelo próprio Supabase no runtime das Edge Functions. |

---

## Primeira ingestão (depois de configurar as chaves)

Você pode esperar o cron da madrugada ou rodar na hora, em `/admin/conteudo`,
nos três botões, na ordem:

1. **Buscar vídeos do canal** (`scrape-youtube-channel`), traz a lista e os metadados
2. **Transcrever pendentes** (`transcribe-videos`), gera os trechos com minutagem
3. **Indexar segmentos** (`index-segments`), gera os embeddings

A transcrição e a indexação trabalham em lote (10 vídeos e 100 segmentos por execução),
para não estourar o tempo limite da Edge Function nem o custo de API de uma vez.
Rode várias vezes até `pendentes` zerar, ou deixe o cron diário consumir a fila sozinho.

Para acessar `/admin/conteudo` e `/admin/audiencia`, o seu usuário precisa ser staff.
Depois de se cadastrar no app, rode no SQL Editor do Supabase:

```sql
update public.profiles
set role = 'content_admin'   -- ou 'audience_manager'
where email = 'seu-email@thiagoconcer.com.br';
```

## Agenda automática

Três jobs no `pg_cron`, já ativos:

| Job | Horário (Brasília) | Etapa |
|---|---|---|
| `cron_scrape_channel` | 03:00 | busca vídeos novos do canal |
| `cron_transcribe` | 03:30 | transcreve os pendentes |
| `cron_index` | 04:00 | gera os embeddings |

Conferir execuções:

```sql
select jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 20;
```
