"""Hero v3 (21 Nov 2026): ONE continuous shot instead of three scenes. Concept from the competitor read: Found-level
cinematic craft, but unmistakably Indian and about family; the feeling of weight loss (lightness, energy, joy), never a
body, number, product or model. Candidates: a kite on a Delhi rooftop at golden hour (lightness, holding the string =
in control, in range), and the grandfather swinging his granddaughter (afternoon-1 from v2, kept as the alternative).
Nano Banana Pro 2k, 4:5 (the hero crops it taller on laptops, wider on phones). Masters in art/hero-v3 (gitignored).
Run: python3 scripts/media/hero-v3-stills.py [name ...]"""
import re, subprocess, sys, urllib.request, pathlib, concurrent.futures as cf
HERE = pathlib.Path(__file__).resolve().parents[2] / "art" / "hero-v3"
HERE.mkdir(parents=True, exist_ok=True)
STYLE = ("Everyone is Indian, from Delhi. Photorealistic cinematic still from a premium Indian healthcare brand film, shot on "
         "a full-frame cinema camera, 35mm lens, shallow depth of field, natural golden-hour light, true-to-life skin, candid "
         "and unposed, real joy caught mid-moment. Warm amber light, soft cream, fresh greens; no teal, no neon, no heavy grade. "
         "Ordinary, real, healthy bodies; never fitness models. No text, no logos, no brand marks. Portrait composition: the "
         "people in the lower-middle of the frame with space above them, faces fully in frame, so it can be cropped taller or "
         "wider without losing anyone.")
SHOTS = {
  "kite-father": "A rooftop terrace in an old South Delhi neighbourhood at golden hour, water tanks and neighbouring "
    "terraces softly out of focus, a few kites far off in the warm sky. An Indian father in his early forties in a white "
    "kurta with rolled sleeves and his eight-year-old daughter in a yellow frock fly a bright green paper kite together; she "
    "holds the spool, he guides the string over her shoulder, both looking up and laughing as the kite climbs. The kite is "
    "high in the upper part of the frame, its thin string visible.",
  "kite-mother": "A rooftop terrace in a leafy Delhi neighbourhood at golden hour, potted bougainvillea along the parapet, "
    "neighbouring terraces softly out of focus, distant kites in the warm sky. An Indian mother in her early forties in a "
    "simple cotton kurta and her ten-year-old son fly a bright green paper kite together; he holds the string, she holds the "
    "spool beside him, both looking up and laughing as it rises. The kite is high in the upper part of the frame, its thin "
    "string visible.",
  "kite-family": "A rooftop terrace in Delhi at golden hour, terracotta pots and a string of marigolds on the parapet, "
    "neighbouring terraces softly out of focus. An Indian grandfather in his early sixties in a cream kurta and his "
    "nine-year-old granddaughter fly a bright green paper kite; he lets her hold the string, his hands lightly over hers, both "
    "laughing up at the sky. The kite is high in the upper part of the frame, its thin string visible.",
}

def make(name):
    out = subprocess.run(["higgsfield", "generate", "create", "nano_banana_pro", "--prompt", f"{SHOTS[name]} {STYLE}",
                          "--aspect_ratio", "4:5", "--resolution", "2k", "--wait", "--wait-timeout", "15m", "--json"],
                         capture_output=True, text=True)
    urls = re.findall(r'"result_url":\s*"([^"]+)"', out.stdout)
    if not urls:
        return f"{name}: no image ({(out.stderr or out.stdout).strip()[-200:]})"
    n = len(list(HERE.glob(f"{name}-*.png"))) + 1
    urllib.request.urlretrieve(urls[0], HERE / f"{name}-{n}.png")
    return f"{name}: {name}-{n}.png"

if __name__ == "__main__":
    names = sys.argv[1:] or list(SHOTS)
    with cf.ThreadPoolExecutor(6) as pool:
        for line in pool.map(make, names + names): print(line)
