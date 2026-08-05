# ConcerFinder

Busca semântica sobre o acervo de vídeos do canal do **Thiago Concer**. A pessoa
descreve uma dor de vendas com as próprias palavras e recebe quais vídeos
assistir, **o minuto exato** de cada insight e um plano de ação.

**No ar:** https://finder.thiagoconcer.com.br

O problema que ele resolve: a busca do YouTube só enxerga título e descrição, e
o insight que a pessoa precisa está no meio de um vídeo de 40 minutos. O
ConcerFinder transcreve o acervo inteiro, quebra em trechos com minutagem, gera
embeddings e responde em cima do que foi **dito**, não do que foi escrito no
título.

O cadastro é obrigatório e é ele que gera o lead. Cada dor pesquisada também
alimenta a segmentação de audiência, que é a frente comercial do produto:
saber qual dor levou cada pessoa até o conteúdo.

---

## Estado atual (05/08/2026)

| | |
|---|---|
| Vídeos no acervo | 500 |
| Indexados e buscáveis | 25 |
| Na fila da ingestão | 462 |
| Trechos com minutagem | 502 |

A ingestão anda sozinha por `pg_cron`. O limite é a cota da YouTube Data API:
250 unidades por vídeo contra 10.000 por dia, ou seja 40 vídeos diários. O cron
processa 35, deixando folga para retentativa. A base fecha em cerca de duas
semanas. Detalhes e como acelerar: [SETUP.md](SETUP.md).

**As três fases do plano estão concluídas.** Além delas: identidade visual da
Concer com tema claro e escuro, painel de audiência, painel de leads, papéis de
acesso, régua de nutrição no ActiveCampaign e camada analítica para o data lake.

---

## Como funciona

**Ingestão** (`scrape-youtube-channel` → `transcribe-videos` → `index-segments`),
diária via `pg_cron`. A transcrição usa a YouTube Data API **como dona do
canal**, via OAuth: desde 2026 o YouTube responde `LOGIN_REQUIRED` para
requisição anônima vinda de IP de datacenter, e nenhum método público de baixar
legenda funciona mais nesse ambiente.

**Busca** (`search-pain`). O embedding da consulta é gerado no servidor, porque
a chave da OpenAI não pode ir para o navegador. A RPC `search_videos` faz
similaridade de cosseno no `pgvector` e grava a busca no perfil de quem
pesquisou.

**Plano de ação** (`generate-action-plan`), com Claude Opus 5, em cima dos
trechos que a busca devolveu.

**Nutrição** (`register-lead` → `sync-nurture`). O cadastro cria o contato no
ActiveCampaign, mas **não** dispara a régua. Quem dispara é a primeira busca:
antes dela não existe dor para contar, e o primeiro e-mail sairia sem aquilo que
ele tem de melhor.

> **Por que OpenAI e Claude ao mesmo tempo:** a Anthropic não oferece API de
> embeddings. O `pgvector` precisa de vetores de 1536 dimensões, e quem os gera
> é o `text-embedding-3-small`. O Claude cobre a geração de texto, o plano de
> ação, que é onde ele é melhor.

---

## Stack

- **Banco e backend:** Supabase (Postgres 17, Auth, Edge Functions em Deno, RLS,
  `pg_cron`, `pg_net`, Vault, `pgvector` 0.8.2)
- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui, fonte Geist
- **Hospedagem:** Vercel, deploy automático a cada push em `main`
- **IA:** OpenAI `text-embedding-3-small` (busca) e Claude Opus 5 (plano de ação)
- **CRM:** ActiveCampaign
- **Data lake:** Nekt, lendo o schema `analytics`

## Estrutura

```
db/              SQL fonte, um arquivo por assunto
supabase/
  migrations/    o mesmo SQL, versionado e aplicado
  functions/     9 Edge Functions
src/             o app React
docs/            documentação viva (ver mapa abaixo)
```

`db/` e `supabase/migrations/` têm o mesmo conteúdo: os arquivos de `db/` são a
leitura por assunto, as migrations são a ordem de aplicação.

---

## Trabalhando no projeto

```bash
npm install
npm run dev                 # desenvolvimento
npm run build               # o build roda o typecheck; use antes de qualquer push
```

**Ao alterar o banco**, sempre nesta ordem, senão o cliente Supabase devolve
tipos errados em silêncio (`select()` vira `never`, `rpc()` recusa argumentos):

```bash
# 1. escreva o SQL em db/<assunto>.sql e copie para supabase/migrations/
# 2. aplique no projeto
# 3. regenere os tipos, para um arquivo temporário primeiro
export SUPABASE_ACCESS_TOKEN=<token>
npx supabase gen types typescript --project-id lzjwiibsqbowrrekptvg --schema public > /tmp/t.ts
# 4. confira que /tmp/t.ts tem conteúdo antes de substituir src/types/supabase.ts
```

> Gerar tipos direto por cima de `src/types/supabase.ts` é armadilha: se o
> comando falhar, a mensagem de erro vai para dentro do arquivo e o projeto para
> de compilar sem motivo aparente.

**Ao publicar Edge Function**, respeite o `verify_jwt` de
`supabase/config.toml`. Passar `--no-verify-jwt` em uma função que exige JWT
remove a trava do gateway:

```bash
npx supabase functions deploy <nome> --project-ref lzjwiibsqbowrrekptvg
```

---

## Mapa da documentação

| Arquivo | O que contém |
|---|---|
| [SKILL.md](SKILL.md) | Guia operacional: convenções, decisões de arquitetura e padrões de segurança. **Leia antes de escrever código.** |
| [SETUP.md](SETUP.md) | Chaves de API, OAuth do YouTube, agenda do cron e ritmo da ingestão. |
| [docs/PROCESSO.md](docs/PROCESSO.md) | O fluxo de negócio: papéis e a jornada da dor até o plano de ação. |
| [docs/ESTRUTURA.md](docs/ESTRUTURA.md) | Tabelas, RLS, functions e rotas. Fonte da verdade de nomenclatura. |
| [docs/PAGINAS.md](docs/PAGINAS.md) | Cada tela: propósito, componentes e estados. |
| [docs/FUNCTIONS.md](docs/FUNCTIONS.md) | Edge Functions e Postgres Functions: assinatura, autenticação e cron. |
| [docs/DEPARA.md](docs/DEPARA.md) | Rastreabilidade tabela → function → página. Checklist de consistência. |
| [docs/PLANO.md](docs/PLANO.md) | O plano em fases e o que foi concluído. |
| [docs/PRD.md](docs/PRD.md) / [docs/PRS.md](docs/PRS.md) | Requisitos de produto e de sistema. |
| [docs/DATALAKE.md](docs/DATALAKE.md) | O contrato com a Nekt: views, host, PII e o que muda sozinho. |
| [docs/nutricao/](docs/nutricao/) | As réguas de e-mail e os prompts de configuração do ActiveCampaign e da Nekt. |

---

## Segurança, em uma linha cada

- RLS ligada em todas as tabelas, com policy explícita por operação.
- `service_role` **nunca** no frontend. Escrita em `leads`, `videos`,
  `video_segments` e `ingestion_runs` só por Edge Function.
- `video_segments` é fechada ao frontend. O acesso passa por RPC
  `SECURITY DEFINER`, que só devolve trecho que o próprio usuário já recuperou.
- Papel de usuário é protegido por trigger, não só por RLS: RLS é por linha e
  não impede alguém de alterar a **coluna** `role` da própria linha.
- O `nekt_reader` enxerga apenas o schema `analytics`, com SELECT e nada mais.
