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

ALVO = 14.2                       # segundos de vídeo final, abaixo do corte do story

# A gravação tem cinco trechos, e cada um pede uma velocidade diferente. O que a
# pessoa faz (digitar, ler, responder) fica perto do tempo real, porque é o que
# dá credibilidade. O que ela só espera (a pergunta chegando, o plano sendo
# escrito) passa voando, porque em story espera é abandono.
m = {k: v / 1000 for k, v in marcos.items()}
INICIO = max(0, m["digitacao"] - 0.35)   # entra já na digitação, sem tela parada

trechos = [
    ("abertura", INICIO, m["trechos"] + 1.2, 1.35),      # digita, busca, vê os trechos
    ("espera da pergunta", m["trechos"] + 1.2, m["pergunta"], 8.0),
    ("resposta", m["pergunta"], m["respondeu"] + 0.6, 1.25),
    ("espera do plano", m["respondeu"] + 0.6, m["plano"], 17.0),
]
# o plano é o trecho elástico: ele recebe o tempo que sobrou do orçamento, nunca
# mais lento que o real nem tão rápido que os títulos não deem para ler
gasto = sum((f - i) / r for _, i, f, r in trechos)
sobra = max(3.0, ALVO - gasto)
trechos.append(("plano", m["plano"], m["fim"], min(2.5, max(1.0, (m["fim"] - m["plano"]) / sobra))))

dur_abertura = (trechos[0][2] - trechos[0][1]) / trechos[0][3]
total = sum((f - i) / r for _, i, f, r in trechos)


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

# a faixa some no meio: ali ela taparia justo a pergunta e o plano, que é o que
# a peça tem para mostrar
partes = "".join(
    f"[0:v]trim={i}:{f},setpts=(PTS-STARTPTS)/{r}[s{n}];" for n, (_, i, f, r) in enumerate(trechos)
)
juntar = "".join(f"[s{n}]" for n in range(len(trechos)))
filtro = (
    f"{partes}{juntar}concat=n={len(trechos)}:v=1:a=0[v];"
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
for nome, i, f, r in trechos:
    print(f"  {nome}: {(f - i):.1f}s reais em {(f - i) / r:.1f}s ({r:.2f}x)")
