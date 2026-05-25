#!/usr/bin/env bash
set -euo pipefail

INPUT_DIR="assets/originals"
OUTPUT_DIR="public/media/icons"
MAX_SIZE="${MAX_SIZE:-160}"
FPS="${FPS:-24}"
MP4_CRF="${MP4_CRF:-20}"
WEBM_CRF="${WEBM_CRF:-30}"

mkdir -p "$OUTPUT_DIR"

for source in "$INPUT_DIR"/*.mp4; do
  name="$(basename "$source" .mp4)"
  scale_filter="scale='if(gt(iw,ih),${MAX_SIZE},-2)':'if(gt(iw,ih),-2,${MAX_SIZE})',fps=${FPS}"

  ffmpeg -y -i "$source" \
    -vf "$scale_filter" \
    -c:v libx264 -crf "$MP4_CRF" -preset slow \
    -pix_fmt yuv420p -movflags +faststart \
    -an "$OUTPUT_DIR/$name.mp4"

  ffmpeg -y -i "$source" \
    -vf "$scale_filter" \
    -c:v libvpx-vp9 -crf "$WEBM_CRF" -b:v 0 -row-mt 1 \
    -an "$OUTPUT_DIR/$name.webm"
done
