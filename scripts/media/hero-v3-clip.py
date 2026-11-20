"""Hero v3 clip: the chosen still as ONE continuous 10 s shot, Kling 4.0 image-to-video 1080p. Two takes per run.
Run: python3 scripts/media/hero-v3-clip.py <still.png> [takes] [loop]
"loop" ends the clip on the same still it starts from, so the film loops perfectly (no jump back)."""
import re, subprocess, sys, urllib.request, pathlib, concurrent.futures as cf
HERE = pathlib.Path(__file__).resolve().parents[2] / "art" / "hero-v3"
still = HERE / sys.argv[1]
takes = int(sys.argv[2]) if len(sys.argv) > 2 else 2
loop = len(sys.argv) > 3 and sys.argv[3] == "loop"
MOTION = ("One continuous shot, no cuts. The father and his daughter fly the green kite together on the rooftop at golden "
          "hour: she lets out a little string from the spool, he guides it over her shoulder, the kite sways and climbs gently "
          "against the warm sky, the string stays one thin taut line from her hands to the kite. They look up, laugh and "
          "glance at each other. A light breeze moves her hair and his kurta. The camera drifts slowly in with a soft handheld "
          "feel" + (", then eases back, and the moment settles back exactly into the opening pose and framing for the last "
          "second." if loop else ".") + " Natural, believable motion of real people; faces, hands, clothes and the kite keep their exact look; no "
          "morphing, no extra people, no text. Calm, cinematic, 24 fps.")

def take(i):
    out = subprocess.run(["higgsfield", "generate", "create", "kling4_0", "--mode", "image-to-video", "--start-image", str(still),
                          *(["--end-image", str(still)] if loop else []),
                          "--prompt", MOTION, "--duration", "10", "--resolution", "1080p", "--aspect_ratio", "auto",
                          "--wait", "--wait-timeout", "30m", "--json"], capture_output=True, text=True)
    urls = re.findall(r'"result_url":\s*"([^"]+)"', out.stdout)
    if not urls:
        return f"take {i}: no clip ({(out.stderr or out.stdout).strip()[-300:]})"
    dst = HERE / f"{still.stem}-{'loop' if loop else 'take'}{i}.mp4"
    urllib.request.urlretrieve(urls[0], dst)
    return f"take {i}: {dst.name}"

if __name__ == "__main__":
    with cf.ThreadPoolExecutor(takes) as pool:
        for line in pool.map(take, range(1, takes + 1)): print(line)
