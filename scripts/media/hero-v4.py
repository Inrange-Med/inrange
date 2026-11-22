"""Hero film v4 (22 Nov 2026). Arhaan: the v3 push-in "looks very AI slop"; make it look real, premium and upper-class
Indian, several moments "extremely well and seamlessly stitched together".

What the research said makes AI footage read as real (scripts/media/README.md):
- the camera never drifts, pans or zooms: each shot is locked off, like a tripod on a real shoot;
- short shots (about 3 s on screen) cut on a beat, so nothing lingers long enough to morph;
- real-time speed, never floaty slow motion; weight in every movement;
- one named light source per shot, side or back light; film grain and one grade over every shot (done in
  hero-v4-encode.sh), so four generations look like one shoot;
- people caught mid-moment, never looking at the camera.
Upper-class Indian, quietly (Nicobar, Good Earth, Condé Nast Traveller India): natural fabrics (linen, handloom,
chikankari), minimal gold jewellery, space and light, considered homes, the leisure of India's affluent today (padel,
golf, a sea-facing weekend home), no logos, nothing flashy.

Run: python3 scripts/media/hero-v4.py stills [name ...]       two 9:16 stills each, Nano Banana Pro 2k (2 credits each)
     python3 scripts/media/hero-v4.py clip <still.png> <model>  one take: veo (Veo 3.1 fast, 6 s, 24 credits) or kling
                                                                (Kling 4.0, 5 s 1080p, about 19 credits)"""
import re, subprocess, sys, urllib.request, pathlib, concurrent.futures as cf

HERE = pathlib.Path(__file__).resolve().parents[2] / "art" / "hero-v4"  # masters (gitignored)
HERE.mkdir(parents=True, exist_ok=True)

LOOK = ("Everyone is Indian, with Indian features and skin tones, well groomed, fit in an ordinary healthy way, never "
        "models. Quiet luxury, nothing flashy: natural fabrics, minimal fine gold jewellery, no logos or brand marks on "
        "clothing, equipment or anything else, no text. Candid documentary lifestyle photograph for a premium Indian "
        "magazine editorial, caught mid-moment, nobody looks at the camera. Shot on 35mm film, Kodak Portra 400, a 50mm "
        "lens at eye level, fine natural film grain, true-to-life colour and skin with visible texture, soft natural "
        "light from one clear source, open shadows. Vertical frame; the people sit in the middle of the frame with "
        "space above and below them; no one cut off at the edge.")

SHOTS = {  # the film's order; each still is the first frame of its shot
  "padel": "Early morning at a private padel club in Gurugram: two Indian women in their late thirties in plain white "
    "sports clothes walk off the blue court past the glass wall, rackets in hand, one laughing at what the other just "
    "said. Low sun from behind them, rim light in their hair, a few trees beyond the court.",
  "verandah": "A sea-facing weekend home in Alibaug in the morning: an Indian couple in their fifties in white linen sit "
    "together on a teak daybed on a wide verandah with lime-washed walls and cane chairs; she laughs with her head "
    "tipped back at something he said, he smiles, a ceramic teapot and two cups on a low table. Soft sunlight from the "
    "left, palms and the grey-blue sea beyond.",
  "fairway": "Golden hour on a lush golf course in Delhi: an Indian father in his early sixties with silver hair, in a "
    "navy polo and cream trousers, a golf bag over his shoulder, walks up the fairway beside his son in his thirties "
    "in a white polo, both laughing. Long shadows on the grass, old trees, warm light from the side.",
  "dance": "Evening in a large sea-facing penthouse in Mumbai: an Indian mother in her forties in an ivory chikankari "
    "kurta with straight trousers and her teenage daughter in a soft linen shirt and loose linen trousers dance barefoot "
    "together in a double-height living room with terrazzo floors, a low linen sofa, a large abstract painting and big "
    "plants, both laughing mid-step. Warm sunset light through tall steel windows from the right, the sea beyond. A "
    "calm, designed home: no air conditioners, ceiling fans or clutter in sight.",
}

MOTION = {  # what happens in each shot, real time; the camera never moves
  "padel": "The two women keep walking towards us off the court, unhurried, rackets swinging, still laughing; one "
    "nudges the other with her shoulder. Their hair moves with each step.",
  "verandah": "She finishes laughing and reaches for her cup, he leans back and says something more, she shakes her "
    "head smiling. A light sea breeze moves the linen and the palms.",
  "fairway": "They keep walking up the fairway at an easy pace, the father says something and the son laughs and "
    "glances at him, the bag shifting on his shoulder with each step.",
  "dance": "They keep dancing to music we cannot hear, small easy steps, the mother does one slow turn, the daughter "
    "laughs and claps once, the kurta sways.",
}
CAMERA = ("Static camera locked off on a tripod for the whole shot: no zoom, no push-in, no pan, no tilt, no camera "
          "movement of any kind; only the people and the air move. Real-time speed, never slow motion, natural weight "
          "in every movement. Faces, hands, clothes and the place keep their exact look; no morphing, no extra people, "
          "no one looks at the camera, no text. Like footage from a real film shoot on 35mm.")


def still(job):
    name, n = job
    out = subprocess.run(["higgsfield", "generate", "create", "nano_banana_pro", "--prompt", f"{SHOTS[name]} {LOOK}",
                          "--aspect_ratio", "9:16", "--resolution", "2k", "--wait", "--wait-timeout", "15m", "--json"],
                         capture_output=True, text=True)
    urls = re.findall(r'"result_url":\s*"([^"]+)"', out.stdout)
    if not urls:
        return f"{name}: no image ({(out.stderr or out.stdout).strip()[-300:]})"
    dst = HERE / f"{name}-{n}.png"
    urllib.request.urlretrieve(urls[0], dst)
    return f"{name}: {dst.name}"


def clip(path, model):
    src = HERE / path
    name = src.stem.split("-")[0]
    prompt = f"{MOTION[name]} {CAMERA}"
    if model == "veo":
        args = ["veo3_1", "--start-image", str(src), "--duration", "6", "--aspect_ratio", "9:16", "--quality", "high"]
    else:
        args = ["kling4_0", "--mode", "image-to-video", "--start-image", str(src), "--duration", "5",
                "--resolution", "1080p", "--aspect_ratio", "auto"]
    out = subprocess.run(["higgsfield", "generate", "create", *args, "--prompt", prompt, "--wait", "--wait-timeout", "30m",
                          "--json"], capture_output=True, text=True)
    urls = re.findall(r'"result_url":\s*"([^"]+)"', out.stdout)
    if not urls:
        return f"{path} {model}: no clip ({(out.stderr or out.stdout).strip()[-300:]})"
    n = 1
    while (HERE / f"{src.stem}-{model}{n}.mp4").exists(): n += 1
    dst = HERE / f"{src.stem}-{model}{n}.mp4"
    urllib.request.urlretrieve(urls[0], dst)
    return f"{path} {model}: {dst.name}"


if __name__ == "__main__":
    if sys.argv[1] == "stills":
        jobs = []
        for name in sys.argv[2:] or list(SHOTS):
            have = len(list(HERE.glob(f"{name}-*.png")))
            jobs += [(name, have + 1), (name, have + 2)]
        with cf.ThreadPoolExecutor(8) as pool:
            for line in pool.map(still, jobs): print(line)
    else:
        pairs = [(sys.argv[i], sys.argv[i + 1]) for i in range(2, len(sys.argv), 2)]
        with cf.ThreadPoolExecutor(8) as pool:
            for line in pool.map(lambda p: clip(*p), pairs): print(line)
