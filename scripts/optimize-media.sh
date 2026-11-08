#!/usr/bin/env bash
# Rebuild public/media/* from the downloaded originals in scripts/source/media.
#
#   bash scripts/optimize-media.sh
#
# See MEDIA_TODO.md for the download commands that produce the source files.

set -euo pipefail
cd "$(dirname "$0")/.."

SRC="scripts/source/media"
OUT="public/media"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg was not found on your PATH."
  echo "  macOS:   brew install ffmpeg"
  echo "  Windows: winget install Gyan.FFmpeg"
  echo "  Ubuntu:  sudo apt install ffmpeg"
  exit 1
fi

if [ ! -d "$SRC" ]; then
  echo "Missing $SRC - download the originals first (MEDIA_TODO.md)."
  exit 1
fi

mkdir -p "$OUT"

image() {
  local src="$1" out="$2" width="$3" quality="$4"
  if [ ! -f "$src" ]; then
    echo "  skip (missing source): $src"
    return
  fi
  echo "  $out (${width}px, q${quality})"
  ffmpeg -hide_banner -loglevel error -y -i "$src" \
    -vf "scale=${width}:-2:flags=lanczos" \
    -c:v libwebp -quality "$quality" -compression_level 6 "$out"
}

video() {
  local src="$1" out="$2" width="$3"
  if [ ! -f "$src" ]; then
    echo "  skip (missing source): $src"
    return
  fi
  echo "  $out (${width}px, h264 crf 27)"
  ffmpeg -hide_banner -loglevel error -y -i "$src" \
    -vf "scale=${width}:-2:flags=lanczos" \
    -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -an \
    -movflags +faststart "$out"
}

echo "Images:"
image "$SRC/plate.webp"              "$OUT/story-poster.webp"       1920 80
image "$SRC/foreground.webp"         "$OUT/story-foreground.webp"   1920 80
image "$SRC/rock.webp"               "$OUT/rock.webp"               1200 80
image "$SRC/solution-chat.webp"      "$OUT/solution-chat.webp"      1400 80
image "$SRC/solution-teammates.webp" "$OUT/solution-teammates.webp" 1400 80
image "$SRC/hero-grid-poster.webp"   "$OUT/hero-grid-poster.webp"   1600 78
image "$SRC/footer-poster.png"       "$OUT/footer-poster.webp"      1600 78

echo "Videos:"
video "$SRC/hero-grid.mp4" "$OUT/hero-grid.mp4" 960
video "$SRC/footer.mp4"    "$OUT/footer.mp4"    1280

echo ""
echo "Done. Sizes:"
du -h "$OUT"/* | sort -h
