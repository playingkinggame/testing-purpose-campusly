#!/usr/bin/env bash
# Extract the scroll-story video into two WebP frame sequences.
#
#   bash scripts/extract-frames.sh
#   bash scripts/extract-frames.sh path/to/other-video.mp4
#
# Writes:
#   public/frames/f_000.webp ...   1600px wide
#   public/frames-sm/f_000.webp ... 960px wide
#   public/frames/manifest.json    { count, width, height }

set -euo pipefail
cd "$(dirname "$0")/.."

SOURCE="${1:-scripts/source/story.mp4}"
FULL_DIR="public/frames"
SMALL_DIR="public/frames-sm"
FULL_WIDTH=1600
SMALL_WIDTH=960

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg was not found on your PATH."
  echo "  macOS:   brew install ffmpeg"
  echo "  Windows: winget install Gyan.FFmpeg"
  echo "  Ubuntu:  sudo apt install ffmpeg"
  exit 1
fi

if [ ! -f "$SOURCE" ]; then
  echo "Missing source video: $SOURCE"
  echo "Download it first - see MEDIA_TODO.md item 1."
  exit 1
fi

mkdir -p "$FULL_DIR" "$SMALL_DIR"
rm -f "$FULL_DIR"/f_*.webp "$SMALL_DIR"/f_*.webp

echo "Extracting ${FULL_WIDTH}px frames from $SOURCE ..."
ffmpeg -hide_banner -loglevel error -y -i "$SOURCE" \
  -vf "scale=${FULL_WIDTH}:-2:flags=lanczos" \
  -c:v libwebp -quality 78 -compression_level 6 \
  -start_number 0 "$FULL_DIR/f_%03d.webp"

echo "Extracting ${SMALL_WIDTH}px frames ..."
ffmpeg -hide_banner -loglevel error -y -i "$SOURCE" \
  -vf "scale=${SMALL_WIDTH}:-2:flags=lanczos" \
  -c:v libwebp -quality 74 -compression_level 6 \
  -start_number 0 "$SMALL_DIR/f_%03d.webp"

COUNT=$(find "$FULL_DIR" -maxdepth 1 -name 'f_*.webp' | wc -l | tr -d ' ')
SMALL_COUNT=$(find "$SMALL_DIR" -maxdepth 1 -name 'f_*.webp' | wc -l | tr -d ' ')
DIMS=$(ffmpeg -hide_banner -i "$FULL_DIR/f_000.webp" 2>&1 | grep -oE '[0-9]{2,5}x[0-9]{2,5}' | head -1 || true)
WIDTH=${DIMS%x*}
HEIGHT=${DIMS#*x}

if [ -z "$DIMS" ] || [ "$WIDTH" = "$DIMS" ]; then
  WIDTH=$FULL_WIDTH
  HEIGHT=0
fi

cat > "$FULL_DIR/manifest.json" <<EOF
{
  "count": $COUNT,
  "width": $WIDTH,
  "height": $HEIGHT
}
EOF

echo ""
echo "Done."
echo "  $FULL_DIR:  $COUNT frames (${WIDTH}x${HEIGHT})"
echo "  $SMALL_DIR: $SMALL_COUNT frames"
echo "  manifest:   $FULL_DIR/manifest.json"
echo ""
echo "The page reads the manifest at boot, so a different frame count is fine."
