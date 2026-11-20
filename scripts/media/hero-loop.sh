#!/bin/sh
# Hero v2 loop: morning -> afternoon -> evening -> back to morning, 0.8 s crossfades, cut so the last frame meets the first.
# Clips are 5.04 s; xfade offsets are multiples of (5.04 - 0.8). Output: public/video/hero-v2-{1080,720}.mp4 + poster.
set -e
cd "$(dirname "$0")/../../art/hero-v2"  # the clips (gitignored); outputs go to public/
L=5.041667; D=0.8
O1=$(echo "$L - $D" | bc -l); O2=$(echo "2*($L - $D)" | bc -l); O3=$(echo "3*($L - $D)" | bc -l)
END=$(echo "$O3 + $D" | bc -l)
OUT=../../public/video; mkdir -p $OUT
ffmpeg -v error -y -i morning.mp4 -i afternoon.mp4 -i evening.mp4 -i morning.mp4 -filter_complex "
  [0:v]settb=AVTB,fps=24,format=yuv420p[a];[1:v]settb=AVTB,fps=24,format=yuv420p[b];
  [2:v]settb=AVTB,fps=24,format=yuv420p[c];[3:v]settb=AVTB,fps=24,format=yuv420p[a2];
  [a][b]xfade=transition=fade:duration=$D:offset=$O1[ab];
  [ab][c]xfade=transition=fade:duration=$D:offset=$O2[abc];
  [abc][a2]xfade=transition=fade:duration=$D:offset=$O3,trim=start=$D:end=$END,setpts=PTS-STARTPTS[v]" \
  -map "[v]" -an -c:v libx264 -preset slow -crf 18 master.mp4
for W in 1080 720; do
  CRF=$([ $W = 1080 ] && echo 28 || echo 28)
  ffmpeg -v error -y -i master.mp4 -vf "scale=$W:-2:flags=lanczos" -an -c:v libx264 -profile:v high -pix_fmt yuv420p \
    -preset slow -crf $CRF -movflags +faststart $OUT/hero-v2-$W.mp4
done
ffmpeg -v error -y -i master.mp4 -vf "select=eq(n\,0),scale=1080:-2:flags=lanczos" -frames:v 1 -q:v 6 ../../public/img/hero-v2-poster.jpg
ls -la $OUT ../../public/img/hero-v2-poster.jpg
ffprobe -v error -show_entries format=duration -of csv=p=0 master.mp4
