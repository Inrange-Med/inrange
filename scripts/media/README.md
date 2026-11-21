# Site media (Higgsfield)

How the hero film (v3, 21 Nov 2026) and the site photos (v2, 20 Nov 2026) were made, so any of them can be remade the same way.
Needs the Higgsfield CLI signed in (`npm i -g @higgsfield/cli`, `higgsfield auth login`, check with
`higgsfield account status`) and ffmpeg. Masters land in `art/` (gitignored); only web exports go to `public/`.

| Script                                     | Does                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `hero-stills.py [name]`                    | two stills per hero moment (morning, afternoon, evening), Nano Banana Pro 2k 4:5                                                          |
| `hero-clips.py [name]`                     | the chosen stills animated, Kling 4.0 image-to-video, 5 s 1080p                                                                           |
| `hero-v3-stills.py [name]`                 | v3, the live hero: candidates for one continuous shot (the kite on a Delhi rooftop), Nano Banana Pro 2k 4:5                               |
| `hero-v3-clip.py still.png [takes] [loop]` | the chosen still as a 10 s Kling 4.0 shot, camera locked off (no zoom); `loop` ends it on its opening frame so it loops with no crossfade |
| `hero-v3-encode.sh [take.mp4]`             | the chosen looping take to `public/video/hero-v3-{1080,720}.mp4` and `public/img/hero-v3-poster.jpg`                                      |
| `hero-loop.sh`                             | v2 (replaced): the three clips joined with 0.8 s crossfades                                                                               |
| `site-shots.py [name]`                     | one still per site photo, same look and rules (see its docstring)                                                                         |
| `site-edit.py in out aspect "instruction"` | a small edit of a chosen master (used to remove laptop logos)                                                                             |
| `site-export.py`                           | the chosen masters to `public/img/<name>-h1.jpg` at web sizes                                                                             |

Costs at the time: a 2k still 2 credits, a 5 s 1080p Kling 4.0 clip about 16. Price first with `higgsfield generate cost`.
Rules every prompt carries (CLAUDE.md compliance): everyone Indian; devices unbranded; no AI person framed as a doctor
or a patient; no scales, food plates, medicine, pens, cold chain or clinics as the subject; nothing intimate; no text.
