# Stories do ConcerFinder

Três variações em 1080x1920 para o Instagram. O link vai pelo sticker nativo, então
o rodapé de cada peça só aponta para cima e não repete a URL: URL escrita dentro da
imagem não é clicável e ainda concorre com o sticker.

| Arquivo | Ângulo | Quando usar |
|---|---|---|
| `story-1.png` | A mecânica em uma frase, com a caixa de busca preenchida | Abertura da sequência, é o que explica o produto mais rápido |
| `story-2.png` | A tela do produto: a dor escrita e o que volta, com minutagem | Segundo frame, prova o que o primeiro prometeu |
| `story-3.png` | Thiago Concer no palco, o acervo e o índice | Fecho, ou peça avulsa para republicar em outro dia |

**Margens.** Tudo importante fica entre 250px do topo e 260px do rodapé, que é a área
livre da interface do Instagram. O rodapé de cada peça foi posicionado acima da faixa
onde o sticker de link costuma cair.

**Regra do número.** Aparece "cerca de 500 vídeos" e nunca junto com "20 anos", conforme
`docs/DIVULGACAO.md`. São 501 no canal e 489 pesquisáveis, e por isso o "cerca de".

**Como regerar** (a copy de cada uma está no HTML ao lado):

```
cd docs/divulgacao/stories
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --virtual-time-budget=4000 --window-size=1080,1920 \
  --screenshot=story-1.png "file://$PWD/story-1.html"
```
