# Stories do ConcerFinder

Dez peças em 1080x1920: **três sequências** (A e B com três frames, C com quatro,
sendo o terceiro em vídeo), mais três avulsas (`story-1`, `story-2`, `story-3`)
que funcionam sozinhas.

O link vai pelo sticker nativo do Instagram, então nenhuma arte traz URL escrita:
URL dentro da imagem não é clicável e ainda concorre com o sticker.

## As três sequências

| Arquivo | Sequência | O que faz |
|---|---|---|
| `carrossel-a-1/2/3` | **A ferramenta explicada** | Diz o que é ("o índice do meu canal"), mostra o que volta (vídeo e minuto) e fecha no plano da semana |
| `carrossel-b-1/2/3` | **Identificação** | Abre com quatro dores em que a pessoa se reconhece, depois explica o que é e fecha no "agora dá pra perguntar" |
| `carrossel-c-1/2` + `-3.mp4` + `-4` | **Antes e agora** | Contrasta como se garimpava o canal com como se pergunta hoje, prova em vídeo com uma busca real e fecha no convite com o link |

**Por que as três abrem dizendo o que é.** É lançamento: quem vê o story não sabe
o que é ConcerFinder, e peça de lançamento que só provoca gasta o primeiro frame
sem entregar contexto. Por isso o selo LANÇAMENTO e a definição aparecem já no
frame 1 de cada sequência (na B, a definição fecha o frame 2, porque ali a
identificação vem antes de propósito).

**Navegação.** Story não tem carrossel: os frames são stories consecutivos. Por isso
o rodapé diz "Toca pra ver o resto" e não "arrasta", e cada peça traz o marcador
`1 · 3`, `2 · 3`, `3 · 3` para quem cair no meio da sequência (na C, `1 · 4` a `4 · 4`).

**Margens.** Tudo importante fica entre 250px do topo e 260px do pé, que é a área
livre da interface do Instagram, e o rodapé fica acima da faixa do sticker.

**Regra do número.** "cerca de 500 vídeos", nunca junto com "20 anos", conforme
`docs/DIVULGACAO.md`. São 501 no canal e 489 pesquisáveis.

## O vídeo da sequência C (`carrossel-c-3.mp4`)

Terceiro frame da C, 14 segundos: a tela do produto de verdade, gravada em
`finder.thiagoconcer.com.br` com uma dor real digitada ("meu time trava quando o
cliente diz que tá caro"), os temas identificados, os trechos com minutagem e o
plano de ação escrito na hora.

**Por que gravar em vez de simular.** A primeira versão era uma animação em HTML,
e ela acertava o layout e errava justo o que convence: o tempo real das coisas
acontecendo e o resultado que o próprio sistema devolveu, com os títulos e os
minutos que existem no canal. Depois do "precisa ser mais real ao sistema", a
simulação foi aposentada.

**A conta usada é interna** (`qa.video@thiagoconcer.com.br`, marcada `is_internal`,
com nome de exibição "Visitante"), então a busca gravada não entra em nenhum número
do painel e o cabeçalho não expõe um nome da equipe.

```
cd docs/divulgacao/stories && node gravar.mjs && python3 montar_video.py
```

`gravar.mjs` abre o Chrome pelo puppeteer em 540x960 com DPR 2 (ou seja, 1080x1920),
faz login fora da gravação, digita, busca e espera o plano. Ele grava `gravacao.webm`
(fora do git, é o material bruto) e `marcos.json`, com o instante de cada etapa.

`montar_video.py` corta a partir desses marcos, e o corte é o ponto todo: a busca
responde em ~7 segundos, mas o plano leva quase 30. Então a digitação e os trechos
ficam em velocidade real, que é o que dá credibilidade, e só a espera do plano passa
17x mais rápido. Por cima entram o marcador `3 · 4` e a faixa "Busca real, sem corte ·
toca pra ver o resto", para o vídeo conversar com as três imagens da sequência.

Para regravar com outra dor, mudar `DOR` no `gravar.mjs`.

## Regerar

A copy das imagens está em `gerar.py`, no dicionário `CARROSSEIS`. Editar e rodar:

```
cd docs/divulgacao/stories && python3 gerar.py
```

O gerador existe para todas dividirem a mesma grade: um punhado de HTML solto diverge
no detalhe, e é a repetição do sistema visual que faz a pessoa reconhecer que os frames
são do mesmo assunto. Na sequência C o índice do arquivo é forçado (`indice=4` no
fecho), porque o terceiro lugar é do vídeo.
