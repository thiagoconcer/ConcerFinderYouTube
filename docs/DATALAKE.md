# Data lake: o contrato entre o ConcerFinder e a Nekt

> Estado verificado em 05/08/2026, conferido contra a API do Supabase e a da
> Nekt, não contra o relatório de quem montou.

## O que a Nekt enxerga

Fonte `postgres-XE7Z` ("ConcerFinder"), ativa, 12 streams, todas em
`FULL_SYNC`, gatilho `30 7 * * *` em `America/Sao_Paulo`.

O acesso é o usuário `nekt_reader`, com SELECT **apenas** no schema `analytics`.
Conferido: das 8 tabelas em `public`, zero são legíveis por ele, e não há acesso
a `auth` nem a `vault`. A descoberta da Nekt encontrou 1 schema, 0 tabelas e 12
views, que é exatamente o desenhado.

O motivo de expor views e não tabelas: elas são um contrato estável. A tabela
pode ganhar coluna, mudar tipo ou virar duas; a view absorve isso sem quebrar
quem consome do outro lado.

## Host de conexão

`aws-0-ca-central-1.pooler.supabase.com:5432` (session pooler), **não**
`db.lzjwiibsqbowrrekptvg.supabase.co`. O host direto resolve só em IPv6 e a
infra da Nekt não alcança IPv6: a conexão morre com "Network is unreachable".
Confirmado contra a API de configuração do Supabase que o hostname do pooler é
esse mesmo.

A porta 5432 no host do pooler é o **session pooler**; 6543 é o transaction
pooler. Para extração de tabela inteira o session é o certo, porque o
transaction não segura cursor longo bem.

## Ao mexer nas views

**Coluna nova entra sozinha.** Onze das doze streams estão com
`extract_all_fields = true`, então basta acrescentar a coluna **no fim** da view
(`create or replace view` só aceita adição no fim) e ela aparece na
sincronização seguinte. Foi assim que `cargo` chegou ao data lake, sem tocar na
fonte.

**A exceção é `dim_videos`**, que ficou com `extract_all_fields = false`. Hoje a
stream lista as 8 colunas que a view tem, então não falta nada. Mas coluna nova
nessa view **não** vai fluir sozinha: precisa ser marcada na fonte, na Nekt.

**View nova não entra sozinha.** Ela vira uma 13ª stream, que precisa ser
habilitada na interface da Nekt. Por isso o corte por cargo foi feito
acrescentando coluna às views existentes, e não criando uma view nova: o dado
chega sem trabalho manual do outro lado.

**Os agregados têm contrato.** `vw_dores_por_perfil`, `vw_desempenho_trechos` e
`vw_engajamento_pessoa` são o que alguém já pode estar consumindo. Mudar o
`group by` delas muda a contagem de linhas para quem lê. Corte novo se faz a
partir do fato, não alterando o agregado.

## Dado pessoal

`dim_pessoas` é a única view com nome, e-mail e WhatsApp, por decisão explícita
(o objetivo declarado é entender comportamento de audiência, o que exige ligar
o comportamento à pessoa). Está isolada de propósito: se um dia a decisão mudar,
troca-se só ela por uma versão pseudonimizada, sem mexer em nenhuma outra.

**A Nekt não tem marcação de PII.** Não há classificação de campo sensível nem
política de retenção por tabela; a aba de configuração da tabela só tem nome e
descrição. O aviso está registrado no campo Description de
`postgres_analytics_dim_pessoas`, que é o mais próximo que a ferramenta oferece.

Vale acompanhar: como a sincronização é full refresh diária, quem apagar a conta
deve sumir do lago na sincronização seguinte. Isso ainda não foi observado na
prática, e é o que sustenta o direito de exclusão. Se a Nekt estiver acumulando
em vez de substituir, o dado apagado sobrevive lá e isso precisa ser tratado.

## Origem do lead

`fato_leads` ganhou `origem`, `utm_source`, `utm_medium`, `utm_campaign`,
`utm_content`, `utm_term`, `referrer` e `landing_page`. Como a stream está em
`extract_all_fields`, as colunas entram sozinhas na próxima sincronização, sem
mexer na fonte.

`origem` já vem derivada pela mesma função que o painel usa, então o data lake
e a tela contam a mesma história.

## Volume

Hoje: 502 trechos vindos de 38 vídeos indexados (13,2 por vídeo). Com os 500
vídeos da base indexados, `dim_trechos` deve ficar na ordem de 6.600 linhas.
Full refresh diário nesse tamanho é confortável, sem necessidade de mudar para
incremental.

`dim_trechos` **não** carrega a coluna `embedding`: são 1536 floats por linha,
sem valor analítico e com um custo de transferência que não se justifica.
