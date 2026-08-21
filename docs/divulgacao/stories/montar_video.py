"""
Monta o vídeo do story (frame 3 da sequência C) a partir da gravação real.

O corte é o ponto todo. A busca responde em ~7 segundos, mas o plano de ação leva
quase 30. Em tela isso é ótimo (é um plano escrito na hora, não uma resposta
pronta); em story é morte. Então só a espera do plano é acelerada: a digitação, os
trechos e a leitura do plano ficam perto da velocidade real, que é o que dá
credibilidade à peça.

O teto de 15s não é estética, é o Instagram: vídeo mais longo vira dois stories, e
aí a numeração 3 · 4 da sequência quebra. Por isso a velocidade do trecho final é
calculada, e não escolhida: ela é o que sobra do orçamento de tempo.
"""
import json
import subprocess
from pathlib import Path

AQUI = Path(__file__).parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
marcos = json.loads((AQUI / "marcos.json").read_text())

ALVO = 14.5                       # segundos de vídeo final, abaixo do corte do story
RITMO_ABERTURA = 1.25             # digitação e busca, quase em tempo real
ACELERA = 17                      # a espera do plano passa voando

# a gravação começa com a tela parada: cortar o ocioso e entrar já na digitação
INICIO = max(0, marcos["digitacao"] - 350) / 1000
LEITURA = marcos["trechos"] / 1000 + 2.5   # tempo de bater o olho nos trechos
PLANO = marcos["plano"] / 1000
FIM = marcos["fim"] / 1000

dur_abertura = (LEITURA - INICIO) / RITMO_ABERTURA
dur_espera = (PLANO - LEITURA) / ACELERA
# o plano é o trecho que pode encolher: nunca mais lento que o real, nem tão rápido
# que a pessoa não consiga ler os títulos enquanto a página desce
sobra = max(3.0, ALVO - dur_abertura - dur_espera)
RITMO_PLANO = min(2.2, max(1.0, (FIM - PLANO) / sobra))


def render(nome: str, corpo: str) -> Path:
    """Desenha uma camada transparente de 1080x1920 para sobrepor ao vídeo."""
    (AQUI / f"{nome}.html").write_text(
        """<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;width:1080px;height:1920px;background:transparent;
    font-family:Geist,-apple-system,Arial,sans-serif}
  .selo{position:absolute;top:150px;right:56px;background:rgba(10,22,40,.86);color:#4E92FF;
    font-size:26px;font-weight:700;letter-spacing:2px;padding:14px 22px;border-radius:12px}
  .faixa{position:absolute;left:60px;right:60px;bottom:150px;background:rgba(10,22,40,.92);
    color:#fff;font-size:32px;font-weight:600;text-align:center;padding:24px 28px;border-radius:18px}
  .faixa span{color:#9DB3D4;font-weight:400}
</style>
""" + corpo, encoding="utf-8")
    saida = AQUI / f"{nome}.png"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--default-background-color=00000000", "--virtual-time-budget=3000",
                    "--window-size=1080,1920", f"--screenshot={saida}",
                    f"file://{AQUI}/{nome}.html"], capture_output=True)
    return saida


selo = render("sobreposicao-selo", '<div class="selo">3 &#183; 4</div>')
faixa = render("sobreposicao-faixa",
               '<div class="faixa">Busca real, sem corte <span>&#183; toca pra ver o resto '
               '&#8594;</span></div>')

total = dur_abertura + dur_espera + (FIM - PLANO) / RITMO_PLANO
# a faixa some enquanto o plano desce: ali ela taparia justo o que interessa ler
filtro = (
    f"[0:v]trim={INICIO}:{LEITURA},setpts=(PTS-STARTPTS)/{RITMO_ABERTURA}[a];"
    f"[0:v]trim={LEITURA}:{PLANO},setpts=(PTS-STARTPTS)/{ACELERA}[b];"
    f"[0:v]trim={PLANO}:{FIM},setpts=(PTS-STARTPTS)/{RITMO_PLANO}[c];"
    f"[a][b][c]concat=n=3:v=1:a=0[v];"
    f"[v][1:v]overlay=0:0[v1];"
    f"[v1][2:v]overlay=0:0:enable='lt(t,{dur_abertura - 1:.2f})+gt(t,{total - 2.2:.2f})',"
    f"fps=30,format=yuv420p[out]"
)
saida = AQUI / "carrossel-c-3.mp4"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(AQUI / "gravacao.webm"),
                "-i", str(selo), "-i", str(faixa),
                "-filter_complex", filtro, "-map", "[out]",
                "-c:v", "libx264", "-preset", "slow", "-crf", "20",
                "-movflags", "+faststart", str(saida)], check=True)

dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                      "-of", "default=nk=1:nw=1", str(saida)], capture_output=True, text=True)
print(f"vídeo: {saida.name} | {float(dur.stdout):.1f}s | {saida.stat().st_size // 1024} KB")
print(f"abertura {dur_abertura:.1f}s a {RITMO_ABERTURA}x · espera {dur_espera:.1f}s a {ACELERA}x "
      f"· plano {(FIM - PLANO) / RITMO_PLANO:.1f}s a {RITMO_PLANO:.2f}x")
