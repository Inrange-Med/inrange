"""Exports the chosen v3 masters (site-v3.py) to public/img/<name>-p1.jpg at web sizes (progressive JPEG, sRGB).
A master drawn with a dark film border (the model's 35mm habit) has it trimmed first."""
import pathlib
from PIL import Image, ImageOps, ImageStat
ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE, OUT = ROOT / "art" / "site-v3", ROOT / "public" / "img"
PICKS = {  # name: (master, long edge)
  "consult-call": ("consult-call-2.png", 1800), "life-day": ("life-day-1.png", 1400), "life-fast": ("life-fast-2.png", 1400),
  "life-late": ("life-late-2.png", 1400), "life-mealprep": ("life-mealprep-2.png", 1400), "life-walk": ("life-walk-1.png", 1400),
  "life-pcos": ("life-pcos-2.png", 1400), "life-private": ("life-private-1.png", 1400), "lodhi-morning": ("lodhi-morning-3.png", 2000),
  "morning-scale": ("morning-scale-1.png", 900), "pharmacy-pack": ("pharmacy-pack-1.png", 1800), "prog-weight": ("prog-weight-2.png", 1440),
  "prog-diabetes": ("prog-diabetes-1.png", 1440), "prog-pcos": ("prog-pcos-1.png", 1440), "prog-intimacy": ("prog-intimacy-2.png", 1440),
  "strength": ("strength-1.png", 1800), "watch": ("watch-1.png", 1800),
}

def trim_border(im):
    """Cut a dark frame drawn round the picture: walk in from each edge while the line is near black."""
    g = im.convert("L"); w, h = g.size
    dark = lambda box: ImageStat.Stat(g.crop(box)).mean[0] < 40
    l = t = 0; r, b = w, h
    while l < w // 10 and dark((l, 0, l + 1, h)): l += 1
    while r > w - w // 10 and dark((r - 1, 0, r, h)): r -= 1
    while t < h // 10 and dark((0, t, w, t + 1)): t += 1
    while b > h - h // 10 and dark((0, b - 1, w, b)): b -= 1
    if (l, t, r, b) == (0, 0, w, h): return im
    pad = 6  # past the soft inner edge of the frame
    box = (l + pad, t + pad, r - pad, b - pad)
    # keep the original aspect ratio, centred
    cw, ch = box[2] - box[0], box[3] - box[1]
    return ImageOps.fit(im.crop(box), (cw, round(cw * h / w)) if cw * h / w <= ch else (round(ch * w / h), ch), Image.LANCZOS)

for name, (master, edge) in PICKS.items():
    im = trim_border(Image.open(HERE / master).convert("RGB"))
    im.thumbnail((edge, edge), Image.LANCZOS)
    path = OUT / f"{name}-p1.jpg"
    im.save(path, "JPEG", quality=82, optimize=True, progressive=True)
    print(f"{path.name:24} {im.size[0]}x{im.size[1]} {path.stat().st_size // 1024} KB")
