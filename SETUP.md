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
| `YOUTUBE_CHANNEL_ID` | `UC7vIOWvsGpl5YXZ13mvaZDQ` (canal do Concer, já confirmado) | idem. |

## Obrigatórias para a transcrição: OAuth do dono do canal

> **Por que isso é necessário.** Verificado em 05/08/2026: o YouTube passou a responder
> `LOGIN_REQUIRED` ("faça login para confirmar que você não é um bot") para requisições
> anônimas vindas de IP de datacenter, o que inclui as Edge Functions do Supabase e
> qualquer VPS. Nenhum método público de baixar legenda funciona mais nesse ambiente.
>
> Como a Concer é **dona do canal**, existe o caminho oficial e gratuito: a YouTube Data
> API permite ao dono baixar as legendas dos próprios vídeos, inclusive as automáticas.
> Isso exige OAuth, não basta a API key.

| Secret | O que é |
|---|---|
| `YOUTUBE_OAUTH_CLIENT_ID` | ID do cliente OAuth criado no Google Cloud |
| `YOUTUBE_OAUTH_CLIENT_SECRET` | Segredo desse mesmo cliente |
| `YOUTUBE_OAUTH_REFRESH_TOKEN` | Token de atualização gerado autorizando com a conta dona do canal |

### Como gerar (uma vez, cerca de 10 minutos)

**1. Crie o cliente OAuth** em console.cloud.google.com, no mesmo projeto da `YOUTUBE_API_KEY`:

- **APIs e serviços → Tela de permissão OAuth**: tipo *Externo*, preencha o básico e adicione o e-mail dono do canal em "Usuários de teste".
- **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**.
- Em "URIs de redirecionamento autorizados", adicione exatamente:
  `https://developers.google.com/oauthplayground`
- Anote o **Client ID** e o **Client secret**.

**2. Gere o refresh token** em https://developers.google.com/oauthplayground:

- Clique na engrenagem (canto superior direito) e marque **"Use your own OAuth credentials"**. Cole o Client ID e o Client secret.
- Na lista da esquerda, cole no campo de escopo: `https://www.googleapis.com/auth/youtube.force-ssl`
- **Authorize APIs** e faça login **com a conta Google que é dona do canal** (esse ponto é o que faz tudo funcionar; outra conta não consegue baixar as legendas).
- Clique em **Exchange authorization code for tokens** e copie o **Refresh token**.

**3. Cole os três** nos Secrets do Supabase e rode a transcrição em `/admin/conteudo`.

### Alternativa paga

Se o OAuth não for viável, `APIFY_TOKEN` (apify.com) contorna o bloqueio do YouTube por conta própria. O código já tenta o Apify automaticamente quando o OAuth não está configurado. Custa por uso e é bem mais caro que o caminho oficial, que é gratuito.

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
| `cron_scrape_channel` | 05:15 | busca vídeos novos do canal |
| `cron_transcribe` | 05:45 | transcreve até 35 pendentes |
| `cron_index` | 06:15 | gera os embeddings |

> **Por que esse horário.** A cota da YouTube Data API zera à meia-noite do
> Pacífico, que é 07:00 UTC no horário de verão e 08:00 UTC fora dele. Rodar a
> partir das 08:15 UTC garante que a esteira sempre pegue a cota recém-renovada,
> nos dois regimes.

### Ritmo de ingestão

Cada vídeo custa **250 unidades** da YouTube Data API (`captions.list` 50 +
`captions.download` 200) contra uma cota diária de 10.000. Ou seja, **40 vídeos
por dia** no plano gratuito. O cron processa 35 por dia, deixando folga para o
scrape e para retentativas.

Falha por cota **não** queima o vídeo: ele volta para `pending` e entra na fila
do dia seguinte. A base de 500 vídeos se completa sozinha em cerca de duas
semanas.

Para acelerar, dá para pedir aumento de cota no Google Cloud (gratuito, via
formulário). Com 100.000 unidades/dia a base fecharia em pouco mais de um dia.

Conferir execuções:

```sql
select jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 20;
```
