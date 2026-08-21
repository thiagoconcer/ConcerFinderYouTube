# Stories do ConcerFinder

Nove peças em 1080x1920: **três sequências de três frames**, mais três avulsas
(`story-1`, `story-2`, `story-3`) que funcionam sozinhas.

O link vai pelo sticker nativo do Instagram, então nenhuma arte traz URL escrita:
URL dentro da imagem não é clicável e ainda concorre com o sticker.

## As três sequências

| Arquivo | Sequência | O que faz |
|---|---|---|
| `carrossel-a-1/2/3` | **A ferramenta explicada** | Diz o que é ("o índice do meu canal"), mostra o que volta (vídeo e minuto) e fecha no plano da semana |
| `carrossel-b-1/2/3` | **Identificação** | Abre com quatro dores em que a pessoa se reconhece, depois explica o que é e fecha no "agora dá pra perguntar" |
| `carrossel-c-1/2/3` | **Antes e agora** | Contrasta garimpar o canal com perguntar, e fecha na foto de palco com o tamanho do acervo |

**Por que as três abrem dizendo o que é.** É lançamento: quem vê o story não sabe
o que é ConcerFinder, e peça de lançamento que só provoca gasta o primeiro frame
sem entregar contexto. Por isso o selo LANÇAMENTO e a definição aparecem já no
frame 1 de cada sequência (na B, a definição fecha o frame 2, porque ali a
identificação vem antes de propósito).

**Navegação.** Story não tem carrossel: os frames são stories consecutivos. Por isso
o rodapé diz "Toca pra ver o resto" e não "arrasta", e cada peça traz o marcador
`1 · 3`, `2 · 3`, `3 · 3` para quem cair no meio da sequência.

**Margens.** Tudo importante fica entre 250px do topo e 260px do pé, que é a área
livre da interface do Instagram, e o rodapé fica acima da faixa do sticker.

**Regra do número.** "cerca de 500 vídeos", nunca junto com "20 anos", conforme
`docs/DIVULGACAO.md`. São 501 no canal e 489 pesquisáveis.

## Vídeo da busca (`video-busca.mp4`)

Simulação da tela do produto em 1080x1920: o campo sendo digitado com uma dor real, o
clique em Buscar, o estado de carregando, os trechos com minutagem aparecendo e o plano
de ação. Dura 9,5 segundos, que cabe num story sem cortar.

**Como é feito, e por que assim.** O estado da tela é função do tempo, e o tempo vem da
URL (`video-busca.html?ms=4200`). Cada quadro é uma captura independente do Chrome, e é
por isso que o estado não pode vir de animação CSS: cada captura sobe um Chrome novo e o
relógio recomeçaria do zero, o que daria quadros fora de ordem. Com o tempo na URL, o
quadro 37 é sempre o mesmo desenho, e a renderização pode rodar em paralelo.

```
cd docs/divulgacao/stories && python3 render_video.py
```

São 191 quadros a 20 fps, montados com ffmpeg em H.264. A renderização leva alguns
minutos; o script pula quadros que já existem, então dá para retomar de onde parou.
Para mudar a dor digitada ou os tempos, editar `FRASE` e a linha do tempo no
`video-busca.html`.

## Regerar

A copy das nove peças está em `gerar.py`, no dicionário `CARROSSEIS`. Editar e rodar:

```
cd docs/divulgacao/stories && python3 gerar.py
```

O gerador existe para as nove dividirem a mesma grade: nove HTML soltos divergem no
detalhe, e é a repetição do sistema visual que faz a pessoa reconhecer que os frames
são do mesmo assunto.
