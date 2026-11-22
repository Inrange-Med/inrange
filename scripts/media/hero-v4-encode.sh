#!/bin/bash
# Hero v4: the four shots cut together for the web, hard cuts, one grade and one film grain over all of them, so four
# generations read as one real shoot (research in scripts/media/README.md). Each shot is cropped from 9:16 to the
# hero's 4:5 around its faces. The film loops by cutting from the last shot back to the first, like any edit.
# A keyframe every second (-g 24) keeps HeroVideo's seek-stepping cheap where autoplay is refused (Low Power Safari).
# Writes public/video/hero-v4-{1080,720}.mp4 and public/img/hero-v4-poster.jpg.
set -e
cd "$(dirname "$0")/../../art/hero-v4"
OUT=../../public/video; mkdir -p $OUT
# clip | first second used | seconds on screen | where the 4:5 crop sits, 0 top to 1 bottom
SHOTS=(
  "padel-1-kling1.mp4|0.3|3.0|0.45"
  "verandah-1-kling1.mp4|0.3|3.0|0.75"
  "fairway-2-kling1.mp4|0.3|3.0|0.70"
  "dance-4-kling1.mp4|0.3|3.0|0.55"
)
# one look for every shot: a touch less saturation and contrast than the model gives, warm mids, lifted blacks
# (film never crushes to black), soft grain that moves every frame
GRADE="eq=saturation=0.92:contrast=0.96,curves=master='0/0.03 0.5/0.51 1/0.97':red='0/0.02 0.5/0.515 1/0.98':blue='0/0.04 0.5/0.49 1/0.95',noise=alls=${GRAIN:-4}:allf=t"
INPUTS=(); FILTER=""; i=0
for s in "${SHOTS[@]}"; do
  IFS='|' read -r CLIP START DUR Y <<< "$s"
  INPUTS+=(-ss "$START" -t "$DUR" -i "$CLIP")
  FILTER+="[$i:v]fps=24,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,"
  FILTER+="crop=1080:1350:0:(1920-1350)*$Y,setsar=1,setpts=PTS-STARTPTS[v$i];"
  i=$((i + 1))
done
CONCAT=""; for j in $(seq 0 $((i - 1))); do CONCAT+="[v$j]"; done
FILTER+="${CONCAT}concat=n=$i:v=1:a=0,$GRADE[cut]"
ffmpeg -v error -y "${INPUTS[@]}" -filter_complex "$FILTER" -map "[cut]" -an -c:v libx264 -preset slow -crf 14 \
  -pix_fmt yuv420p master-cut.mp4
for W in 1080 720; do
  CRF=$([ $W = 1080 ] && echo 24 || echo 26)
  ffmpeg -v error -y -i master-cut.mp4 -vf "scale=$W:-2:flags=lanczos" -an -c:v libx264 -profile:v high -pix_fmt yuv420p \
    -preset slow -crf $CRF -g 24 -keyint_min 24 -sc_threshold 0 -movflags +faststart $OUT/hero-v4-$W.mp4
done
ffmpeg -v error -y -i master-cut.mp4 -vf "select=eq(n\,0),scale=1080:-2:flags=lanczos" -frames:v 1 -q:v 4 \
  ../../public/img/hero-v4-poster.jpg
ls -la $OUT/hero-v4-* ../../public/img/hero-v4-poster.jpg
