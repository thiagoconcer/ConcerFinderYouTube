"""
Gera os stories do ConcerFinder: 3 carrosséis de 3 frames, 1080x1920.

Por que um gerador e não nove arquivos soltos: as nove peças dividem a mesma
grade, a mesma margem de segurança e o mesmo rodapé. Escrever nove HTML à mão
faz as três sequências divergirem no detalhe, e é justamente a repetição do
sistema visual que faz a pessoa reconhecer que os frames são do mesmo assunto.

Trocar copy: editar CARROSSEIS embaixo e rodar `python3 gerar.py`.
"""
import html
import subprocess
from pathlib import Path

AQUI = Path(__file__).parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FOTO = "../../../public/thiago-concer-palco.webp"

# margem de segurança: a interface do Instagram come ~250px no topo e ~260px no
# pé, e o sticker de link costuma cair na faixa de baixo
BASE = """
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;position:relative;
  font-family:Geist,-apple-system,'Helvetica Neue',Arial,sans-serif;
  background:%(fundo)s;color:%(texto)s}
.luz{position:absolute;width:1100px;height:1100px;left:-240px;top:-240px;
  background:radial-gradient(circle,rgba(46,116,232,.28) 0%%,rgba(46,116,232,0) 62%%)}
.area{position:absolute;top:250px;left:80px;right:80px;bottom:260px;display:flex;flex-direction:column;z-index:2}
.miolo{flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:40px}
.marca{display:flex;align-items:center;gap:14px}
.marca .bola{width:44px;height:44px;border-radius:50%%;background:#2E74E8;color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800}
.marca span{font-size:30px;font-weight:600;letter-spacing:-.5px}
.marca b{color:#2E74E8}
/* marcador de posição: story não tem carrossel nativo, então a ordem precisa
   ficar visível para quem cai no segundo frame primeiro */
.passo{margin-left:auto;font-size:26px;font-weight:600;letter-spacing:2px;color:%(passo)s}
h1{font-size:%(titulo)spx;line-height:1.05;letter-spacing:-3px;font-weight:700}
h1 em{font-style:normal;color:#2E74E8}
.selo{display:inline-block;align-self:flex-start;background:#2E74E8;color:#fff;font-size:24px;
  font-weight:700;letter-spacing:2.4px;padding:12px 20px;border-radius:10px;margin-bottom:34px}
.oque{margin-top:38px;border-left:5px solid #2E74E8;padding-left:26px;font-size:34px;line-height:1.4;color:%(suave)s}
.oque b{color:%(texto)s;font-weight:600}
.sub{margin-top:30px;font-size:36px;line-height:1.4;color:%(suave)s;max-width:840px}
.rodape{position:absolute;left:80px;right:80px;bottom:150px;z-index:2;font-size:31px;color:%(suave)s}
.rodape b{color:%(texto)s;font-weight:600}
/* o CTA final tem peso de botão: é a única linha da peça que pede ação */
.rodape.cta{background:#2E74E8;color:#fff;font-size:36px;font-weight:600;text-align:center;
  padding:26px 30px;border-radius:18px;box-shadow:0 18px 44px rgba(46,116,232,.38)}
.rodape.cta b{color:#fff;font-weight:800}
"""

DARK = {"fundo": "#0A1628", "texto": "#fff", "suave": "#9DB3D4", "passo": "#4E92FF", "titulo": "76"}
LIGHT = {"fundo": "#F6F8FC", "texto": "#0C1726", "suave": "#647189", "passo": "#2E74E8", "titulo": "76"}


def pagina(tema, extra_css, corpo, passo, rodape, luz=True, fundo=""):
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>{BASE % tema}{extra_css}</style></head><body>
{fundo}
{'<div class="luz"></div>' if luz else ''}
<div class="area">
  <div class="marca"><div class="bola">&#9654;</div><span><b>Concer</b>Finder</span>
    <span class="passo">{passo}</span></div>
  <div class="miolo">{corpo}</div>
</div>
<div class="rodape{' cta' if 'Grátis' in rodape else ''}">{rodape}</div>
</body></html>"""


CAIXA = """
.campo{margin-top:52px;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.16);
  border-radius:24px;padding:36px 38px}
.campo p{font-size:40px;line-height:1.35;color:#DCE6F7}
.cursor{display:inline-block;width:3px;height:40px;background:#2E74E8;vertical-align:-6px;margin-left:6px}
.res{margin-top:44px;display:flex;align-items:center;gap:22px}
.play{width:76px;height:76px;border-radius:20px;background:#2E74E8;color:#fff;flex:none;
  display:flex;align-items:center;justify-content:center;font-size:34px}
.res h3{font-size:31px;font-weight:600;letter-spacing:-.4px}
.res p{font-size:27px;color:#9DB3D4;margin-top:6px}
.passos{margin-top:46px}
.passos li{list-style:none;display:flex;gap:20px;align-items:flex-start;margin-bottom:26px;font-size:33px;line-height:1.35}
.passos b{color:#2E74E8;font-weight:700;flex:none}
"""

DORES = """
.dores{margin-top:44px;display:flex;flex-direction:column;gap:22px}
.dores div{background:#fff;border:1px solid #E3E8F0;border-radius:22px;padding:28px 32px;
  font-size:35px;line-height:1.3;box-shadow:0 18px 40px rgba(12,23,38,.07)}
.chave{margin-top:40px;background:#0A1628;color:#fff;border-radius:26px;padding:40px 42px}
.chave p:first-child{font-size:24px;font-weight:600;letter-spacing:1.6px;color:#4E92FF;text-transform:uppercase}
.chave p:last-child{margin-top:16px;font-size:40px;line-height:1.3;font-weight:600;letter-spacing:-.8px}
"""

FOTO_CSS = """
.foto{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:1240px;height:1420px;
  object-fit:cover;object-position:50% 12%}
.fade{position:absolute;inset:0;background:linear-gradient(180deg,#0A1628 0%,rgba(10,22,40,.93) 32%,
  rgba(10,22,40,.55) 50%,rgba(10,22,40,.86) 76%,#0A1628 100%)}
.numero{margin-top:70px;display:flex;align-items:baseline;gap:20px}
.numero .kicker{font-size:27px;color:#9DB3D4;position:absolute;margin-top:-44px}
.numero b{font-size:104px;font-weight:800;letter-spacing:-5px;line-height:1}
.numero span{font-size:33px;color:#C6D6F0;line-height:1.25;max-width:430px}
"""

APP = """
/* o print da ferramenta: mesma tela do vídeo, parada no resultado */
.app{margin-top:40px;background:#fff;border-radius:28px;overflow:hidden;color:#0C1726;
  box-shadow:0 30px 70px rgba(0,0,0,.45)}
.app .barra{height:72px;border-bottom:1px solid #E3E8F0;display:flex;align-items:center;
  padding:0 26px;gap:10px;font-size:21px;color:#647189}
.app .ponto{width:10px;height:10px;border-radius:50%;background:#D5DDEA}
.app .dentro{padding:28px 26px 30px}
.app .dor{border:2px solid #D5DDEA;border-radius:16px;padding:20px 22px;font-size:26px;color:#0C1726}
.app .rotulo{margin-top:26px;font-size:18px;font-weight:700;letter-spacing:1.6px;color:#647189;text-transform:uppercase}
.app .item{display:flex;gap:18px;align-items:flex-start;margin-top:20px}
.app .thumb{width:104px;height:70px;border-radius:11px;background:#0A1628;flex:none;color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:24px}
.app .item h3{font-size:25px;line-height:1.25;font-weight:600}
.app .min{display:inline-block;margin-top:8px;background:#E8F0FE;color:#1A5CCC;font-size:20px;
  font-weight:600;padding:5px 11px;border-radius:8px}
.app .plano{margin-top:24px;background:#0A1628;color:#fff;border-radius:16px;padding:22px 24px}
.app .plano p:first-child{font-size:18px;font-weight:700;letter-spacing:1.5px;color:#4E92FF;text-transform:uppercase}
.app .plano p:last-child{margin-top:8px;font-size:24px;line-height:1.35}
"""

ANTES = """
.lista{margin-top:44px;display:flex;flex-direction:column;gap:20px}
.lista div{display:flex;gap:20px;align-items:flex-start;font-size:33px;line-height:1.32;color:#DCE6F7}
.lista .x{color:#FF5B5B;font-size:30px;flex:none;margin-top:5px}
.tempo{margin-top:42px;font-size:31px;color:#9DB3D4}
"""

CTA = "<b>Grátis.</b> Toca no link aqui em cima &#8593;"

CARROSSEIS = {
    # ---------------------------------------------------------------- A
    # Lançamento explicado em três tempos: o que é, o que devolve, o que fazer
    # com o que voltou. É a sequência para quem nunca ouviu falar.
    "a": [
        dict(tema=DARK, css=CAIXA, passo="1 &#183; 3", rodape="Toca pra ver o resto &#8594;", corpo="""
  <span class="selo">LANÇAMENTO</span>
  <h1>ConcerFinder:<br>o <em>índice</em> do<br>meu canal.</h1>
  <p class="oque">São <b>cerca de 500 vídeos</b> de vendas no YouTube, de graça.
    Agora dá pra <b>perguntar</b> em vez de garimpar.</p>
  <div class="campo"><p>“meu time trava quando o cliente diz que tá caro”<span class="cursor"></span></p></div>"""),
        dict(tema=DARK, css=CAIXA, passo="2 &#183; 3", rodape="Toca pra ver o resto &#8594;", corpo="""
  <h1>Ele devolve o vídeo<br>e o <em>minuto exato</em>.</h1>
  <div class="res"><div class="play">&#9654;</div>
    <div><h3>Objeção de preço: o que fazer antes do desconto</h3><p>abre no minuto 4:12</p></div></div>
  <div class="res"><div class="play">&#9654;</div>
    <div><h3>Como treinar a resposta que o time não tem</h3><p>abre no minuto 9:38</p></div></div>
  <p class="sub">Não é o vídeo inteiro. É o trecho onde a resposta está.</p>"""),
        dict(tema=DARK, css=CAIXA, passo="3 &#183; 3", rodape=CTA, corpo="""
  <h1>E um plano<br>pra <em>esta semana</em>.</h1>
  <ul class="passos">
    <li><b>1.</b> O que fazer na próxima ligação</li>
    <li><b>2.</b> O que levar pra reunião de segunda</li>
    <li><b>3.</b> Como saber se funcionou</li>
  </ul>
  <p class="oque"><b>É gratuito.</b> Do cadastro à primeira resposta, 2 minutos.</p>"""),
    ],
    # ---------------------------------------------------------------- B
    # Identificação primeiro, definição no mesmo frame: a pessoa se reconhece
    # numa frase e já lê o que é a ferramenta, sem precisar do frame seguinte.
    "b": [
        dict(tema=LIGHT, css=DORES, luz=False, passo="1 &#183; 3", rodape="Toca pra ver o resto &#8594;", corpo="""
  <span class="selo">LANÇAMENTO</span>
  <h1>Alguma dessas<br>é <em>tua</em>?</h1>
  <div class="dores">
    <div>“O cliente diz que tá caro e eu congelo”</div>
    <div>“Mandei a proposta e ele sumiu”</div>
    <div>“Meu time não faz follow-up”</div>
    <div>“Treinei e em duas semanas voltaram ao antigo”</div>
  </div>"""),
        dict(tema=LIGHT, css=DORES, luz=False, passo="2 &#183; 3", rodape="Toca pra ver o resto &#8594;", corpo="""
  <h1>Todas já foram<br><em>respondidas</em>.</h1>
  <p class="oque">Estão em algum lugar dos <b>cerca de 500 vídeos</b> do meu canal,
    de graça, desde sempre. Faltava saber <b>em qual, e em qual minuto</b>.</p>
  <div class="chave"><p>O que é o ConcerFinder</p>
    <p>O índice do canal: você escreve a dor, ele abre o vídeo no minuto certo.</p></div>"""),
        dict(tema=LIGHT, css=DORES, luz=False, passo="3 &#183; 3", rodape=CTA, corpo="""
  <h1>Agora dá<br>pra <em>perguntar</em>.</h1>
  <p class="oque">Escreve a dor com as suas palavras. Ele acha o trecho, abre o vídeo
    no minuto certo e monta o <b>plano da sua semana</b>.</p>
  <div class="chave"><p>Quanto custa</p><p>Nada. É gratuito, e continua sendo.</p></div>"""),
    ],
    # ---------------------------------------------------------------- C
    # Contraste: como era procurar contra como é perguntar. Fecha na foto,
    # onde a autoridade entra sem precisar ser dita.
    "c": [
        dict(tema=DARK, css=ANTES, passo="1 &#183; 3", rodape="Toca pra ver o resto &#8594;", corpo="""
  <span class="selo">LANÇAMENTO</span>
  <h1 style="font-size:64px">Como você fazia<br>pra achar conteúdo<br>no YouTube <em>ontem</em>?</h1>
  <div class="lista">
    <div><span class="x">&#10006;</span> Pesquisar e torcer pro algoritmo te entregar bons vídeos</div>
    <div><span class="x">&#10006;</span> Perder 20, 30 minutos ou até 1h procurando algo que resolva</div>
    <div><span class="x">&#10006;</span> Assistir 3, 4, 5 vídeos pra tentar achar 1 resposta</div>
    <div><span class="x">&#10006;</span> Desistir e ficar sem resposta</div>
  </div>
  <p class="tempo">A resposta estava lá o tempo todo.</p>"""),
        dict(tema=DARK, css=CAIXA, passo="2 &#183; 3", rodape="Toca pra ver o resto &#8594;", corpo="""
  <h1>Como você pode<br>fazer <em>hoje</em>.</h1>
  <p class="oque">Com o ConcerFinder, o <b>índice do canal</b>: você descreve a situação
    e ele acha o trecho em que eu trato exatamente dela.</p>
  <div class="campo"><p>“o cliente some depois que eu mando a proposta”<span class="cursor"></span></p></div>
  <div class="res"><div class="play">&#9654;</div>
    <div><h3>Follow-up: como voltar sem parecer insistente</h3><p>abre no minuto 6:41</p></div></div>"""),
        dict(tema=DARK, css=APP, passo="3 &#183; 3", rodape=CTA, corpo="""
  <h1 style="font-size:62px">Segundos, e não<br>uma noite de<br>domingo <em>garimpando</em>.</h1>
  <div class="app">
    <div class="barra"><span class="ponto"></span><span class="ponto"></span><span class="ponto"></span>
      <span style="margin-left:12px">finder.thiagoconcer.com.br</span></div>
    <div class="dentro">
      <div class="dor">“o cliente some depois que eu mando a proposta”</div>
      <p class="rotulo">3 trechos para assistir</p>
      <div class="item"><div class="thumb">&#9654;</div>
        <div><h3>Follow-up: como voltar sem parecer insistente</h3><span class="min">minuto 6:41</span></div></div>
      <div class="item"><div class="thumb">&#9654;</div>
        <div><h3>O erro que faz o cliente sumir depois da proposta</h3><span class="min">minuto 2:08</span></div></div>
      <div class="plano"><p>Seu plano de ação</p>
        <p>O que fazer na próxima ligação e o que cobrar na segunda.</p></div>
    </div>
  </div>"""),
    ],
}


def main():
    gerados = []
    for nome, frames in CARROSSEIS.items():
        for i, f in enumerate(frames, start=1):
            arquivo = AQUI / f"carrossel-{nome}-{i}.html"
            fundo = f'<img class="foto" src="{FOTO}" alt=""><div class="fade"></div>' if f.get("foto") else ""
            arquivo.write_text(
                pagina(f["tema"], f["css"], f["corpo"], f["passo"], f["rodape"],
                       luz=f.get("luz", True), fundo=fundo),
                encoding="utf-8",
            )
            png = arquivo.with_suffix(".png")
            subprocess.run(
                [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                 "--virtual-time-budget=4000", "--window-size=1080,1920",
                 f"--screenshot={png}", f"file://{arquivo}"],
                capture_output=True, check=False,
            )
            gerados.append(png.name)
    print(f"{len(gerados)} frames:", ", ".join(gerados))


if __name__ == "__main__":
    main()
