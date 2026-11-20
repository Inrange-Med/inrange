"""Hero v2 clips: each chosen still animated with Kling 4.0 (image-to-video, 5 s, 1080p). Run: python3 scripts/media/hero-clips.py [name ...]"""
import re, subprocess, sys, urllib.request, pathlib, concurrent.futures as cf
HERE = pathlib.Path(__file__).resolve().parents[2] / "art" / "hero-v2"  # masters (gitignored)
HERE.mkdir(parents=True, exist_ok=True)
KEEP = (" Natural, believable motion of real people; faces, hands and clothes stay exactly as they are, no morphing, no extra "
        "people, no text. Calm, cinematic, 24 fps feel.")
CLIPS = {
  "morning": ("morning-2.png", "The two friends keep walking towards the camera at an easy, brisk pace, laughing and chatting; "
              "leaves stir in a light breeze and sunlight flickers through the trees. The camera glides slowly backwards with them."),
  "afternoon": ("afternoon-1.png", "The grandfather gently sways his granddaughter from side to side like an aeroplane, both "
                "laughing; the sheer curtains drift in the breeze and the sunlight shimmers. A slow, gentle push-in."),
  "evening": ("evening-2.png", "He twirls her once under his arm and they both laugh, swaying together to the music; a little "
              "steam rises from a pan far behind them. Gentle handheld camera with a slight push-in."),
}

def make(name):
    still, motion = CLIPS[name]
    out = subprocess.run(["higgsfield", "generate", "create", "kling4_0", "--mode", "image-to-video", "--start-image", str(HERE / still),
                          "--prompt", motion + KEEP, "--duration", "5", "--resolution", "1080p", "--aspect_ratio", "auto",
                          "--wait", "--wait-timeout", "25m", "--json"], capture_output=True, text=True)
    urls = re.findall(r'"result_url":\s*"([^"]+)"', out.stdout)
    if not urls:
        return f"{name}: no clip ({(out.stderr or out.stdout).strip()[-400:]})"
    urllib.request.urlretrieve(urls[0], HERE / f"{name}.mp4")
    return f"{name}: {name}.mp4"

if __name__ == "__main__":
    with cf.ThreadPoolExecutor(3) as pool:
        for line in pool.map(make, sys.argv[1:] or list(CLIPS)): print(line)
