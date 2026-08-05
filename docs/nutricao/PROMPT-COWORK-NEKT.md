# Prompt para o Claude Cowork: conectar o ConcerFinder ao Nekt

> **Como usar:** cole este documento inteiro como prompt no Claude Cowork, com acesso ao navegador.
> Ele configura a fonte de dados no Nekt e devolve, no fim, um JSON que o Claude Code usa
> para conferir o pipeline.

---

## Contexto

O **ConcerFinder** é uma busca semântica sobre os vídeos do canal do Thiago Concer. A pessoa descreve uma dor de vendas e recebe os trechos certos com a minutagem exata.

O objetivo aqui é levar os dados de comportamento da audiência para o **Nekt** (data lake): quem se cadastrou, o que cada pessoa procurou, o que foi recomendado e o que ela realmente abriu.

O banco é PostgreSQL no Supabase. **Já preparei uma camada pronta para você conectar:** um schema `analytics` só com views, e um usuário de leitura dedicado. Você não precisa escolher tabelas nem escrever SQL, é só apontar para o schema.

---

## Credenciais de conexão

Crie no Nekt uma fonte de dados **PostgreSQL** com exatamente isto:

| Campo | Valor |
|---|---|
| Host | `db.lzjwiibsqbowrrekptvg.supabase.co` |
| Porta | `5432` |
| Banco | `postgres` |
| Usuário | `nekt_reader` |
| Senha | `pxLLxijuMmNZaz0I197tbfUkIzx9LBID` |
| Schema | `analytics` |
| SSL | **obrigatório** (`require`) |
| Versão | PostgreSQL 17.6 |
| Região | ca-central-1 |

Nome sugerido da fonte: **`ConcerFinder`**.

> Se o Nekt não conseguir conectar em `5432` por não ter IPv6, procure no painel do Supabase
> (Project Settings → Database → Connection string → **Session pooler**) o host que começa com
> `aws-` e termina em `pooler.supabase.com`, porta `5432`, e use o usuário no formato
> `nekt_reader.lzjwiibsqbowrrekptvg`. A senha é a mesma. Registre no JSON de retorno qual host funcionou.

**Este usuário só lê o schema `analytics`.** Ele não enxerga as tabelas originais, nem o schema de autenticação, nem os vetores de busca. Foi verificado: 0 de 8 tabelas do schema `public` são legíveis por ele. Se algum passo pedir mais permissão do que isso, **não force**, anote no retorno.

---

## O que sincronizar

Traga **as 12 views** do schema `analytics`. Elas já vêm nomeadas e prontas:

### Dimensões (quem e o quê)

| View | Conteúdo | Volume atual |
|---|---|---|
| `dim_pessoas` | Cadastrados: nome, e-mail, WhatsApp, perfil comercial, status da nutrição | 2 |
| `dim_videos` | Vídeos do canal e o estado na esteira de ingestão | 500 |
| `dim_trechos` | Trechos transcritos com minutagem e temas | 502 |

### Fatos (o que aconteceu)

| View | Conteúdo | Volume atual |
|---|---|---|
| `fato_buscas` | Cada dor pesquisada, com perfil de quem pesquisou | 2 |
| `fato_temas_buscados` | Um tema por linha, para ranking de dores | |
| `fato_recomendacoes` | O que a busca devolveu, com relevância e se foi aberto | 12 |
| `fato_visualizacoes` | O que a pessoa realmente abriu | 0 (começa a encher agora) |
| `fato_leads` | Leads e estado da régua de nutrição | |
| `fato_ingestao` | Saúde da esteira de transcrição e indexação | |

### Agregados prontos

| View | Conteúdo |
|---|---|
| `vw_dores_por_perfil` | Dores mais buscadas, cruzadas por perfil comercial |
| `vw_desempenho_trechos` | Recomendado x aberto por trecho, com taxa de abertura |
| `vw_engajamento_pessoa` | Uma linha por pessoa com o resumo do comportamento |

---

## Configuração da sincronização

- **Frequência:** diária. Os dados são de comportamento, não de operação em tempo real, e a esteira de ingestão roda de madrugada.
- **Horário sugerido:** depois das **07:00 (horário de Brasília)**, para pegar a ingestão da noite já concluída.
- **Modo:** cópia completa (*full refresh*) em todas as views. O volume é pequeno (centenas de linhas, não milhões) e as views não têm coluna confiável de atualização incremental. Se o Nekt exigir modo incremental em alguma, use `fato_*` com o campo de data correspondente (`buscado_em`, `aberto_em`, `recomendado_em`, `gerado_em`).
- **Camada de destino:** se o Nekt pedir para escolher (bronze/raw, silver, gold), coloque tudo em **raw/bronze**. As views já vêm tratadas, mas a modelagem de negócio dentro do Nekt é decisão de outra etapa.

---

## Depois de conectar

1. **Rode a primeira sincronização** e confirme que as 12 views chegaram.
2. **Confira os volumes** contra a tabela acima. `fato_visualizacoes` vindo com 0 linhas é esperado, a métrica acabou de entrar no ar.
3. **Não crie transformações nem dashboards ainda.** Esta etapa é só a fundação do pipeline.

---

## Aviso importante sobre dado pessoal

A view `dim_pessoas` contém **nome, e-mail e WhatsApp** de pessoas reais. É intencional, foi decisão do cliente, e é a única view com dado pessoal identificável.

Ao configurar:
- Se o Nekt oferecer marcação de PII, campos sensíveis ou política de retenção, **ative** para essa view e registre no retorno o que foi ativado.
- **Não** exporte, cole ou reproduza registros reais dessa view em nenhum lugar (chat, print, documento). Trabalhe com contagens.

---

## O que me devolver (obrigatório)

Ao terminar, responda com este JSON preenchido:

```json
{
  "status": "concluido",
  "fonte": {
    "nome": "ConcerFinder",
    "source_id": "",
    "tipo": "postgresql",
    "host_que_funcionou": "",
    "porta": 5432,
    "schema": "analytics",
    "ssl": true,
    "conexao_testada_com_sucesso": true
  },
  "views_sincronizadas": [
    { "view": "dim_pessoas", "linhas": 0, "ok": true },
    { "view": "dim_videos", "linhas": 0, "ok": true },
    { "view": "dim_trechos", "linhas": 0, "ok": true },
    { "view": "fato_buscas", "linhas": 0, "ok": true },
    { "view": "fato_temas_buscados", "linhas": 0, "ok": true },
    { "view": "fato_recomendacoes", "linhas": 0, "ok": true },
    { "view": "fato_visualizacoes", "linhas": 0, "ok": true },
    { "view": "fato_leads", "linhas": 0, "ok": true },
    { "view": "fato_ingestao", "linhas": 0, "ok": true },
    { "view": "vw_dores_por_perfil", "linhas": 0, "ok": true },
    { "view": "vw_desempenho_trechos", "linhas": 0, "ok": true },
    { "view": "vw_engajamento_pessoa", "linhas": 0, "ok": true }
  ],
  "agendamento": {
    "frequencia": "diaria",
    "horario": "",
    "fuso": "",
    "modo": "full refresh"
  },
  "primeira_sincronizacao": {
    "executada": true,
    "resultado": "",
    "duracao": ""
  },
  "pii": {
    "view_com_dado_pessoal": "dim_pessoas",
    "marcacao_disponivel_no_nekt": false,
    "o_que_foi_ativado": ""
  },
  "problemas_encontrados": [],
  "decisoes_que_precisei_tomar": []
}
```

**Se algo não for possível** exatamente como descrito, não invente solução silenciosa: faça o mais próximo, e descreva em `decisoes_que_precisei_tomar` o que mudou e por quê. Em especial, se precisar de permissão que o `nekt_reader` não tem, **pare e relate**, em vez de tentar outro usuário.
