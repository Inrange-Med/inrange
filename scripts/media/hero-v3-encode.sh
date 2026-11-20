#!/bin/sh
# Hero v3: the chosen looping take (it ends on its opening frame) encoded for the web, no crossfade needed. The last
# frame matches the first, so it is dropped to avoid a repeated frame at the seam (240 frames = 10 s at 24 fps).
# Writes public/video/hero-v3-{1080,720}.mp4 and public/img/hero-v3-poster.jpg.
set -e
cd "$(dirname "$0")/../../art/hero-v3"
SRC=${1:-kite-father-2-loop1.mp4}
OUT=../../public/video; mkdir -p $OUT
for W in 1080 720; do
  CRF=$([ $W = 1080 ] && echo 22 || echo 24)  # a calm single shot compresses well: spend it on quality
  ffmpeg -v error -y -i "$SRC" -vf "trim=end_frame=240,setpts=PTS-STARTPTS,fps=24,scale=$W:-2:flags=lanczos" -an \
    -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow -crf $CRF -movflags +faststart $OUT/hero-v3-$W.mp4
done
ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,0),scale=1080:-2:flags=lanczos" -frames:v 1 -q:v 4 ../../public/img/hero-v3-poster.jpg
ls -la $OUT/hero-v3-* ../../public/img/hero-v3-poster.jpg
