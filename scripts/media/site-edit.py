"""One-off edits on a chosen master (Higgsfield nano_banana_pro with the image as reference). Run (from art/site-v2): python3 ../../scripts/media/site-edit.py <in.png> <out.png> <aspect> "<instruction>" """
import re, subprocess, sys, urllib.request
src, dst, aspect, instruction = sys.argv[1:5]
out = subprocess.run(["higgsfield", "generate", "create", "nano_banana_pro", "--image", src, "--prompt", instruction,
                      "--aspect_ratio", aspect, "--resolution", "2k", "--wait", "--wait-timeout", "15m", "--json"], capture_output=True, text=True)
urls = re.findall(r'"result_url":\s*"([^"]+)"', out.stdout)
if not urls: sys.exit((out.stderr or out.stdout)[-400:])
urllib.request.urlretrieve(urls[0], dst); print(dst)
