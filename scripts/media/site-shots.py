"""Site images v2 (Nov 2026): the hero's look (warm, cheerful, real people, Delhi NCR) for every photo on the site except
the doctors' real portraits. Each keeps its place and job. Higgsfield nano_banana_pro 2k. Masters stay here (art/ is
gitignored); export.sh grades and writes public/img/<name>-h1.jpg.
Rules (CLAUDE.md compliance): no AI person framed as a doctor or a patient; no scales, weight, food plates as the subject,
medicine, pens, cold chain, clinics; nothing intimate; no text or logos.
Run: python3 scripts/media/site-shots.py [name ...]"""
import re, subprocess, sys, urllib.request, pathlib, concurrent.futures as cf
HERE = pathlib.Path(__file__).resolve().parents[2] / "art" / "site-v2"  # masters (gitignored)
HERE.mkdir(parents=True, exist_ok=True)
STYLE = ("Everyone in the picture is Indian (South Asian, from Delhi NCR), with Indian features, skin tones and styling. "
         "Laptops, phones, speakers and appliances are plain and unbranded: no logos anywhere. Only the people the scene "
         "describes appear; no one cut off at the edge of the frame. "
         "Photorealistic editorial lifestyle photograph for a modern Indian healthcare brand. Candid and unposed, caught "
         "mid-moment, warm and positive. Full-frame camera, 50mm lens, shallow depth of field, soft natural light, true-to-life "
         "skin texture, no retouched or plastic look. Colour: warm daylight, fresh leaf greens, soft cream and charcoal; no teal, "
         "no neon, no grey gloomy grade. Ordinary, real, healthy bodies, never fitness models. No text, no logos, no watermarks, "
         "no brand marks on clothing or objects.")
SHOTS = {
  # name: (aspect, scene)
  "consult-call": ("4:3", "A bright Delhi home in the morning: a woman in her late forties sits at her dining table on a video call "
    "on her laptop, wearing small wireless earbuds, smiling warmly and nodding as she listens, a notebook and a cup of tea beside "
    "her. The laptop screen faces away from the camera so nothing on it is visible. Sunlight through a window, plants."),
  "life-day": ("4:5", "An ordinary weekday evening: a husband and wife in their fifties walk down their leafy residential lane in "
    "South Delhi at golden hour, chatting and laughing, she in a light cotton salwar kameez with a dupatta, he in a half-sleeve "
    "shirt. Parked scooters, bougainvillea over a gate, warm low sun."),
  "life-fast": ("4:5", "A festival fasting day morning: a woman in her forties in a deep maroon kurta stands on her sunlit balcony "
    "with a small brass diya and fresh marigolds on the ledge, smiling as she reads a message on her phone. Potted tulsi, city "
    "rooftops soft behind."),
  "life-late": ("4:5", "A late shift: a man in his thirties at his desk at home in the evening, laughing at something on a call, "
    "a steel tiffin and a glass of water beside his laptop, a warm desk lamp, the city lights soft through the window behind. "
    "Relaxed and cheerful, not tired."),
  "life-mealprep": ("4:5", "A Sunday morning: an Indian man in his forties, short dark hair and a trimmed beard, in a grey "
    "t-shirt, tosses a fresh chana salad with cucumber and tomato in a big steel bowl in his bright home kitchen, smiling to "
    "himself with music playing, morning sun on the counter."),
  "life-walk": ("4:5", "A morning walk in a Delhi park: a woman in her sixties in a white cotton kurta and her son in his thirties "
    "in a dark track jacket walk side by side under old trees, both laughing, her arm hooked through his. Soft golden mist."),
  "life-pcos": ("4:5", "A morning at home: an Indian woman in her late twenties with long dark hair in a plait, in a grey t-shirt and black leggings does a bodyweight squat "
    "on a yoga mat in her sunlit living room, grinning, a plant and a sofa behind her. Easy, everyday movement."),
  "life-private": ("4:5", "An evening at home: an Indian woman in her late thirties, dark hair loosely tied, sits at her desk on a video call with wired earphones, "
    "relaxed and smiling, a warm lamp and a small plant beside her laptop. The screen faces away from the camera."),
  "lodhi-morning": ("16:9", "Wide view of Lodhi Garden in New Delhi at sunrise: two friends in their forties walk away from the "
    "camera along a stone path through green lawns towards a Mughal-era tomb, long golden shadows, mist in the trees. Small figures "
    "in a large calm landscape, the left half open lawn and sky."),
  "morning-scale": ("4:5", "A bright morning at home, close-up from knee height: bare feet stepping onto a sleek white smart "
    "scale on a warm wooden floor in soft sunlight, a potted plant and the edge of a jute rug beside it. The scale's display is "
    "blank, no numbers. Fresh, light and everyday, the start of a good day."),
  "pharmacy-pack": ("4:5", "A product still life at home: a sealed matte white pharmacy box with a small square coded seal sticker "
    "on its lid rests on a warm wooden table in morning window light; a hand holds a phone above the seal as if to scan it. "
    "No words or brand names on the box, no medicine visible, no ice or cold packs."),
  "prog-weight": ("4:5", "An early morning walk: a man in his forties in a dark quilted vest over a t-shirt walks briskly along a "
    "leafy park path in Gurugram, smiling, sunlight through the trees."),
  "prog-diabetes": ("4:5", "A woman in her fifties with grey hair in a bun, in a soft green cotton kurta, stirs a pot on the stove "
    "in her sunny Delhi kitchen and laughs to herself. She is alone in the frame. Cooking is the moment; no plates in the foreground."),
  "prog-pcos": ("4:5", "An Indian woman in her twenties with straight dark hair, in a cream cotton kurta, on a sunny window seat at home, holding a cup of tea in both hands, laughing, "
    "plants on the sill, morning light."),
  "prog-intimacy": ("4:5", "A couple in their thirties sit close on a sofa at home in daylight, both laughing at a shared joke, "
    "relaxed and fully dressed in casual clothes. Warm and companionable, nothing romantic or suggestive."),
  "strength": ("4:5", "A woman in her thirties in a grey t-shirt and black leggings does a one-arm dumbbell row on a low wooden "
    "bench in her bright living room, smiling with effort, a rug and plants around her."),
  "watch": ("4:5", "Dawn on a stone step outside a Delhi house: close-up of an Indian man in his forties with dark hair and a moustache, tying his grey running shoes, a "
    "smartwatch on his wrist, a potted plant beside him, warm first light."),
}

def make(name):
    aspect, scene = SHOTS[name]
    out = subprocess.run(["higgsfield", "generate", "create", "nano_banana_pro", "--prompt", f"{scene} {STYLE}",
                          "--aspect_ratio", aspect, "--resolution", "2k", "--wait", "--wait-timeout", "15m", "--json"],
                         capture_output=True, text=True)
    urls = re.findall(r'"result_url":\s*"([^"]+)"', out.stdout)
    if not urls:
        return f"{name}: no image ({(out.stderr or out.stdout).strip()[-300:]})"
    n = len(list(HERE.glob(f"{name}-*.png"))) + 1
    urllib.request.urlretrieve(urls[0], HERE / f"{name}-{n}.png")
    return f"{name}: {name}-{n}.png"

if __name__ == "__main__":
    with cf.ThreadPoolExecutor(8) as pool:
        for line in pool.map(make, sys.argv[1:] or list(SHOTS)): print(line)
