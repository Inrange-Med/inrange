"""Site photos v3 (22 Nov 2026), made to match the hero film v4: real, premium, upper-class Indian (Arhaan: "premium,
fancy, like the vibe of our product"; "even the images need to be the same"). Every photo keeps its place, subject and
job from v2 (site-shots.py); only the world and the photography change: the same 35mm film look and quiet luxury as
hero-v4.py. Nano Banana Pro 2k, two candidates each. Masters in art/site-v3 (gitignored); site-v3-export.py writes
public/img/<name>-p1.jpg.
Rules (CLAUDE.md compliance): everyone Indian; devices unbranded; no AI person framed as a doctor or a patient; no scales
as a subject except morning-scale (display blank), no food plates, medicine, pens, cold chain or clinics; nothing
intimate; no text or logos.
Run: python3 scripts/media/site-v3.py [name ...]"""
import re, subprocess, sys, urllib.request, pathlib, concurrent.futures as cf

HERE = pathlib.Path(__file__).resolve().parents[2] / "art" / "site-v3"
HERE.mkdir(parents=True, exist_ok=True)

LOOK = ("Everyone is Indian, with Indian features and skin tones, well groomed, fit in an ordinary healthy way, never "
        "models. Quiet luxury, nothing flashy: natural fabrics (linen, handloom cotton, chikankari), minimal fine gold "
        "jewellery, calm designed spaces with good materials, no clutter. Laptops, phones and appliances are plain and "
        "unbranded; no logos or brand marks on clothing or anything else; no text. Candid documentary lifestyle "
        "photograph for a premium Indian magazine editorial, caught mid-moment, nobody looks at the camera. Shot on "
        "35mm film, Kodak Portra 400, a 50mm lens at eye level, fine natural film grain, true-to-life colour and skin "
        "with visible texture, soft natural light from one clear source, open shadows. Only the people the scene "
        "describes appear; no one cut off at the edge of the frame.")

SHOTS = {  # name: (aspect, scene)
  "consult-call": ("4:3", "Morning in the drawing room of a white Lutyens' Delhi bungalow: an Indian woman in her late "
    "forties in a handloom linen kurta and small gold earrings sits at a teak dining table on a video call on a plain "
    "laptop, small wireless earbuds in, smiling and nodding as she listens, a notebook and a cup of tea in fine china "
    "beside her. The laptop screen faces away from the camera. Tall windows with sunlight from the left, a large "
    "painting, a brass bowl, big plants."),
  "life-day": ("4:5", "An ordinary weekday evening: an Indian husband and wife in their fifties walk down a quiet "
    "tree-lined lane of bungalows in Golf Links, New Delhi, at golden hour, chatting and laughing, she in a handloom "
    "cotton sari, he in a linen shirt and trousers. White bungalow walls, bougainvillea over a wrought-iron gate, old "
    "trees, warm low sun from behind."),
  "life-fast": ("4:5", "A festival fasting day morning: an Indian woman in her forties in an ivory chikankari kurta "
    "stands on the stone verandah of her farmhouse outside Delhi, a small brass diya and fresh marigolds on a carved "
    "ledge, smiling as she reads a message on her phone. Potted tulsi, a lawn and old trees beyond, soft morning sun."),
  "life-late": ("4:5", "A late shift: an Indian man in his thirties in a soft knit shirt in his home study high up in "
    "a Worli apartment in the evening, laughing at something on a call on his plain laptop, a glass of water and a "
    "notebook beside it, a warm brass desk lamp, walnut shelves with books, the city lights of Mumbai soft through the "
    "window behind. Relaxed and cheerful, not tired."),
  "life-mealprep": ("4:5", "A Sunday morning: an Indian man in his forties, short dark hair and a trimmed beard, in a "
    "grey linen shirt with the sleeves rolled, tosses a fresh salad of chickpeas, cucumber and tomato in a large "
    "handmade ceramic bowl at the marble island of his bright, designed kitchen, smiling to himself, morning sun from "
    "the window on the counter, brass fittings, herbs in pots."),
  "life-walk": ("4:5", "A morning walk in Lodhi Garden, New Delhi: an Indian woman in her sixties in a white chikankari "
    "kurta with a soft pashmina shawl and her son in his thirties in a navy quilted jacket walk side by side under old "
    "trees, both laughing, her arm hooked through his. Soft golden mist, a Mughal-era dome far behind."),
  "life-pcos": ("4:5", "A morning at home: an Indian woman in her late twenties with long dark hair in a plait, in a "
    "plain grey top and black leggings, does a bodyweight squat on a natural cork yoga mat on the oak floor of a "
    "bright, airy room with linen curtains and a large plant, grinning. Easy, everyday movement, sunlight from the "
    "side."),
  "life-private": ("4:5", "An evening at home: an Indian woman in her late thirties, dark hair loosely tied, in a "
    "silk-cotton kurta, sits at a walnut desk in her calm study on a video call with wired earphones, relaxed and "
    "smiling, a warm lamp, books and a small plant beside her plain laptop. The screen faces away from the camera."),
  "lodhi-morning": ("16:9", "Wide view of Lodhi Garden in New Delhi at sunrise: an Indian husband and wife in their "
    "forties walk away from the camera along a stone path through green lawns towards a Mughal-era tomb, she in a white "
    "linen kurta with a soft pashmina over her shoulders, he in a navy knit and cream trousers, her hand on his arm; "
    "dressed differently, never matching. Long golden shadows, mist in the trees. Small figures in a large calm "
    "landscape, on the right of the frame; the left half open lawn and sky."),
  "morning-scale": ("4:5", "A bright morning at home, close-up from knee height: bare feet stepping onto a sleek white "
    "smart scale on a pale travertine bathroom floor in soft sunlight, the edge of a linen towel and a plant beside "
    "it. The scale's display is blank, no numbers. Fresh, light and calm, the start of a good day."),
  "pharmacy-pack": ("4:5", "A product still life at home: a sealed matte white box with a small square coded seal "
    "sticker on its lid rests on a travertine console in morning window light; a hand with a fine gold ring holds a "
    "plain phone above the seal as if to scan it. No words or brand names on the box, no medicine visible, no ice or "
    "cold packs."),
  "prog-weight": ("4:5", "An early morning walk: an Indian man in his forties in a dark quilted vest over a plain "
    "t-shirt walks briskly along a path through the lawns of a Gurugram golf estate, smiling, sunlight through old "
    "trees."),
  "prog-diabetes": ("4:5", "An Indian woman in her fifties with grey hair in a bun, in a soft green handloom kurta, "
    "stirs a brass pot on the stove in her sunny, designed Delhi kitchen with marble counters, and laughs to herself. "
    "She is alone in the frame. Cooking is the moment; no plates in the foreground."),
  "prog-pcos": ("4:5", "An Indian woman in her twenties with straight dark hair, in a cream linen kurta, on a "
    "cushioned window seat in a sunlit heritage apartment, holding a cup of tea in both hands, laughing, plants on "
    "the sill, morning light."),
  "prog-intimacy": ("4:5", "An Indian couple in their thirties sit close on a low linen sofa in a light-filled Bandra "
    "apartment in daylight, both laughing at a shared joke, relaxed and fully dressed in linen. Warm and companionable, "
    "nothing romantic or suggestive."),
  "strength": ("4:5", "An Indian woman in her thirties in a plain grey top and black leggings does a one-arm dumbbell "
    "row on a low oak bench in a calm, light-filled home gym with oak floors and a large window, smiling with effort."),
  "watch": ("4:5", "Dawn on the stone steps of a white bungalow porch in Delhi: close-up of an Indian man in his "
    "forties with dark hair and a moustache, tying his grey running shoes, a plain smartwatch on his wrist, a large "
    "terracotta planter beside him, warm first light."),
}


def make(job):
    name, n = job
    aspect, scene = SHOTS[name]
    out = subprocess.run(["higgsfield", "generate", "create", "nano_banana_pro", "--prompt", f"{scene} {LOOK}",
                          "--aspect_ratio", aspect, "--resolution", "2k", "--wait", "--wait-timeout", "15m", "--json"],
                         capture_output=True, text=True)
    urls = re.findall(r'"result_url":\s*"([^"]+)"', out.stdout)
    if not urls:
        return f"{name}: no image ({(out.stderr or out.stdout).strip()[-300:]})"
    urllib.request.urlretrieve(urls[0], HERE / f"{name}-{n}.png")
    return f"{name}: {name}-{n}.png"


if __name__ == "__main__":
    jobs = []
    for name in sys.argv[1:] or list(SHOTS):
        have = len(list(HERE.glob(f"{name}-*.png")))
        jobs += [(name, have + 1), (name, have + 2)]
    with cf.ThreadPoolExecutor(8) as pool:
        for line in pool.map(make, jobs): print(line)
