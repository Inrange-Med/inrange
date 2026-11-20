"""Hero v2 stills (Higgsfield, nano_banana_pro 2k 4:5). Masters stay in art/ (gitignored). Run: python3 scripts/media/hero-stills.py [name ...]"""
import json, re, subprocess, sys, urllib.request, pathlib, concurrent.futures as cf
HERE = pathlib.Path(__file__).resolve().parents[2] / "art" / "hero-v2"  # masters (gitignored)
HERE.mkdir(parents=True, exist_ok=True)
STYLE = ("Photorealistic editorial lifestyle photograph for a modern Indian healthcare brand. Candid, joyful, unposed, "
         "caught mid-moment. Full-frame camera, 50mm lens, shallow depth of field, soft natural light, true-to-life skin "
         "texture, no retouched or plastic look. Colour: warm daylight, fresh leaf greens, soft cream and charcoal; no teal, "
         "no neon, no heavy grading. No text, no logos, no watermarks, no brand marks on clothing. Portrait composition with "
         "the people centred and room above their heads, faces in the upper-middle of the frame, so the picture can be cropped "
         "taller or wider without losing anyone.")
SHOTS = {
  "morning": "Early morning in a leafy Delhi heritage garden like Lodhi Garden: golden sunrise light through old trees, a "
    "Mughal-era stone dome soft and out of focus far behind. Two Indian women friends in their early forties walk briskly side "
    "by side towards the camera on a gravel path, mid-stride, one laughing with her head tilted back, the other grinning at her. "
    "Everyday clothes for a walk: a loose cream kurta-style top with leggings, a heather-grey t-shirt with track pants, white "
    "sneakers. Ordinary, healthy, real bodies, natural hair. A feeling of energy and lightness.",
  "afternoon": "Late afternoon in a bright, airy Gurugram apartment living room with tall windows, sheer curtains, indoor plants "
    "and warm wooden floors. An Indian grandfather in his late fifties with a salt-and-pepper beard, in a soft olive cotton shirt "
    "and linen trousers, lifts his delighted five-year-old granddaughter high above his head; both are laughing, her arms spread "
    "wide as if flying. Sunlight streams in behind them. An ordinary, real body, not a fitness model. Pure joy and energy.",
  "evening": "Evening in a warm, modern Indian home kitchen with soft pendant lights, brass and terracotta accents and green herbs "
    "on the windowsill. An Indian couple in their mid-thirties dance playfully by the counter, he twirls her by the hand, both "
    "laughing as if their favourite song just came on. She wears a mustard cotton top and jeans, he a white linen shirt. "
    "Ordinary, real bodies. The cooking is incidental and soft in the background; no plates of food in the foreground. "
    "A feeling of ease and lightness.",
}

def make(name, n):
    prompt = f"{SHOTS[name]} {STYLE}"
    out = subprocess.run(["higgsfield", "generate", "create", "nano_banana_pro", "--prompt", prompt, "--aspect_ratio", "4:5",
                          "--resolution", "2k", "--wait", "--wait-timeout", "15m", "--json"], capture_output=True, text=True)
    text = out.stdout.strip()
    urls = re.findall(r'"result_url":\s*"([^"]+)"', text)
    try:
        if urls: raise StopIteration
        data = json.loads(text[text.index("{"):] if "{" in text else text)
        def walk(x):
            if isinstance(x, dict):
                for v in x.values(): walk(v)
            elif isinstance(x, list):
                for v in x: walk(v)
            elif isinstance(x, str) and x.startswith("http") and any(x.split("?")[0].endswith(e) for e in (".png", ".jpg", ".jpeg", ".webp")):
                urls.append(x)
        walk(data)
    except StopIteration:
        pass
    except Exception:
        urls = [w for w in text.split() if w.startswith("http")]
    if not urls:
        return f"{name}-{n}: no image ({out.stderr.strip()[-300:] or text[-300:]})"
    path = HERE / f"{name}-{n}.{urls[0].split('?')[0].rsplit('.', 1)[-1]}"
    urllib.request.urlretrieve(urls[0], path)
    return f"{name}-{n}: {path.name}"

if __name__ == "__main__":
    names = sys.argv[1:] or list(SHOTS)
    jobs = [(n, i) for n in names for i in (1, 2)]
    with cf.ThreadPoolExecutor(6) as pool:
        for line in pool.map(lambda j: make(*j), jobs): print(line)
