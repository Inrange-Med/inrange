# Site media (Higgsfield)

How the hero film (v4, 22 Nov 2026) and the site photos (v3, 22 Nov 2026) were made, so any of them can be remade the same way.
Needs the Higgsfield CLI signed in (`npm i -g @higgsfield/cli`, `higgsfield auth login`, check with
`higgsfield account status`) and ffmpeg. Masters land in `art/` (gitignored); only web exports go to `public/`.

| Script                                     | Does                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `hero-stills.py [name]`                    | two stills per hero moment (morning, afternoon, evening), Nano Banana Pro 2k 4:5                                                          |
| `hero-clips.py [name]`                     | the chosen stills animated, Kling 4.0 image-to-video, 5 s 1080p                                                                           |
| `hero-v3-stills.py [name]`                 | v3 (replaced): candidates for one continuous shot (the kite on a Delhi rooftop), Nano Banana Pro 2k 4:5                                   |
| `hero-v3-clip.py still.png [takes] [loop]` | the chosen still as a 10 s Kling 4.0 shot, camera locked off (no zoom); `loop` ends it on its opening frame so it loops with no crossfade |
| `hero-v3-encode.sh [take.mp4]`             | the chosen looping take to `public/video/hero-v3-{1080,720}.mp4` and `public/img/hero-v3-poster.jpg`                                      |
| `hero-v4.py stills [name]`                 | v4, the live hero: two 9:16 stills per shot (padel, verandah, fairway, dance), Nano Banana Pro 2k                                         |
| `hero-v4.py clip still.png kling\|veo ...` | one take per still: Kling 4.0 (5 s 1080p, the camera stays put) or Veo 3.1 (it tracked and drew a tripod: not used)                       |
| `hero-v4-encode.sh`                        | the four shots, 3 s each, hard cuts, one grade and grain, cropped to 4:5, to `public/video/hero-v4-{1080,720}.mp4` and the poster         |
| `site-v3.py [name]`                        | v3, live: the 17 site photos in the film's world (same subject and job as v2), two candidates each                                        |
| `site-v3-export.py`                        | the chosen v3 masters to `public/img/<name>-p1.jpg` (trims a drawn film border)                                                           |
| `hero-loop.sh`                             | v2 (replaced): the three clips joined with 0.8 s crossfades                                                                               |
| `site-shots.py [name]`                     | v2 (replaced): one still per site photo, same look and rules (see its docstring)                                                          |
| `site-edit.py in out aspect "instruction"` | a small edit of a chosen master (used to remove laptop logos)                                                                             |
| `site-export.py`                           | v2 (replaced): the chosen masters to `public/img/<name>-h1.jpg`                                                                           |

Costs at the time: a 2k still 2 credits, a 5 s 1080p Kling 4.0 clip about 16. Price first with `higgsfield generate cost`.
Rules every prompt carries (CLAUDE.md compliance): everyone Indian; devices unbranded; no AI person framed as a doctor
or a patient; no scales, food plates, medicine, pens, cold chain or clinics as the subject; nothing intimate; no text.

## Why v4 looks the way it does (22 Nov 2026)

Arhaan: the v3 push-in "looks very AI slop"; it must not feel like an AI video, look premium and upper-class Indian,
"extremely well and seamlessly stitched together", and the photos the same.

- What makes generated footage read as real (Higgsfield, Morphic, Dreamina and Inizio guides; Function Health's "Long
  Live" campaign of everyday moments): the camera never drifts, pans or zooms (locked off, like a tripod); short shots
  cut on a beat before anything can morph (about 3 s here); real-time speed, never floaty slow motion; one named light
  source, side or back light; film grain and one grade across every shot; candid, nobody looking at the camera; prompts
  that name a film stock and lens instead of "cinematic" or "realistic".
- Upper-class Indian, quietly (Nicobar, Good Earth, Condé Nast Traveller India; health as the new status among India's
  affluent, padel and golf as their leisure): natural fabrics (linen, handloom, chikankari), minimal fine gold, calm
  designed homes (terrazzo, travertine, teak, cane, art), Lutyens' Delhi bungalows, Lodhi Garden, a sea-facing Alibaug
  weekend home, a Mumbai penthouse; no logos, nothing flashy.
- Kling 4.0 kept the camera still; Veo 3.1 tracked backwards and drew a tripod into the shot, so every shot is Kling.
