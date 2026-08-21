"""Renderiza os quadros do vídeo e monta o MP4. Cada quadro é uma captura
independente com ?ms= na URL, por isso pode rodar em paralelo sem sair de ordem."""
import subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

AQUI = Path(__file__).parent
QUADROS = AQUI / "quadros"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FPS, PASSO, FIM = 20, 50, 9500   # 50ms por quadro = 20 fps, 9,5s de duração

QUADROS.mkdir(exist_ok=True)

def quadro(par):
    i, ms = par
    # pula o que já existe: renderizar 190 quadros leva minutos, e retomar de
    # onde parou vale mais do que a pureza de começar do zero
    if (QUADROS / f"f-{i:04d}.png").exists():
        return
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--virtual-time-budget=1800", "--window-size=1080,1920",
                    f"--screenshot={QUADROS}/f-{i:04d}.png",
                    f"file://{AQUI}/video-busca.html?ms={ms}"],
                   capture_output=True, check=False)

pares = list(enumerate(range(0, FIM + 1, PASSO)))
with ThreadPoolExecutor(max_workers=6) as ex:
    list(ex.map(quadro, pares))

feitos = sorted(QUADROS.glob("f-*.png"))
print(f"{len(feitos)} quadros de {len(pares)}")
if len(feitos) < len(pares):
    sys.exit("faltou quadro, não vou montar o vídeo com buraco")

subprocess.run(["ffmpeg", "-y", "-framerate", str(FPS), "-i", f"{QUADROS}/f-%04d.png",
                "-c:v", "libx264", "-preset", "slow", "-crf", "20",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                str(AQUI / "video-busca.mp4")], capture_output=True, check=True)
print("vídeo:", (AQUI / "video-busca.mp4").stat().st_size // 1024, "KB")
