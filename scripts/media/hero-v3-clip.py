"""Hero v3 clip: the chosen still as ONE continuous 10 s shot, Kling 4.0 image-to-video 1080p. Two takes per run.
Run: python3 scripts/media/hero-v3-clip.py <still.png> [takes] [loop]
"loop" ends the clip on the same still it starts from, so the film loops perfectly (no jump back)."""
import re, subprocess, sys, urllib.request, pathlib, concurrent.futures as cf
HERE = pathlib.Path(__file__).resolve().parents[2] / "art" / "hero-v3"
still = HERE / sys.argv[1]
takes = int(sys.argv[2]) if len(sys.argv) > 2 else 2
loop = len(sys.argv) > 3 and sys.argv[3] == "loop"
MOTION = ("One continuous shot from a camera locked off on a tripod: no zoom, no push-in, no pan, no camera movement at "
          "all; only the people, the kite and the air move. The father and his daughter fly the green kite together on the "
          "rooftop at golden hour: she lets out a little string from the spool, he steadies it over her shoulder, the kite "
          "sways gently against the warm sky and the thin string stays one taut line from her hands to the kite. Natural, "
          "relaxed and unhurried, like real home footage: they look up at the kite, she says something, he smiles and laughs "
          "softly, she grins up at him; small, believable expressions, nothing exaggerated, no posing for the camera. A "
          "light breeze moves her hair and his kurta, and other kites drift far off in the sky" + (". In the last second "
          "they settle back into exactly the opening pose." if loop else ".") + " Faces, hands, clothes and the kite keep "
          "their exact look; no morphing, no extra people, no text. 24 fps, true to life.")

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
