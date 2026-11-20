"""Exports the chosen masters to public/img/<name>-h1.jpg at web sizes (progressive JPEG, sRGB). Run from anywhere."""
import pathlib
from PIL import Image
HERE = pathlib.Path(__file__).resolve().parents[2] / "art" / "site-v2"  # masters (gitignored)
HERE.mkdir(parents=True, exist_ok=True)
OUT = pathlib.Path(__file__).resolve().parents[2] / "public" / "img"
PICKS = {  # name: (master, long edge)
  "consult-call": ("consult-call-2.png", 1800), "life-day": ("life-day-1.png", 1400), "life-fast": ("life-fast-1.png", 1400),
  "life-late": ("life-late-3.png", 1400), "life-mealprep": ("life-mealprep-2.png", 1400), "life-walk": ("life-walk-3.png", 1400),
  "life-pcos": ("life-pcos-4.png", 1400), "life-private": ("life-private-2.png", 1400), "lodhi-morning": ("lodhi-morning-1.png", 2000),
  "morning-scale": ("morning-scale-2.png", 900), "pharmacy-pack": ("pharmacy-pack-1.png", 1800), "prog-weight": ("prog-weight-1.png", 1440),
  "prog-diabetes": ("prog-diabetes-2.png", 1440), "prog-pcos": ("prog-pcos-2.png", 1440), "prog-intimacy": ("prog-intimacy-1.png", 1440),
  "strength": ("strength-1.png", 1800), "watch": ("watch-3.png", 1800),
}
for name, (master, edge) in PICKS.items():
    im = Image.open(HERE / master).convert("RGB")
    im.thumbnail((edge, edge), Image.LANCZOS)
    path = OUT / f"{name}-h1.jpg"
    im.save(path, "JPEG", quality=82, optimize=True, progressive=True)
    print(f"{path.name:24} {im.size[0]}x{im.size[1]} {path.stat().st_size // 1024} KB")
