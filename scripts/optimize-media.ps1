# Rebuild public\media\* from the downloaded originals in scripts\source\media.
#
#   powershell -ExecutionPolicy Bypass -File scripts/optimize-media.ps1
#
# See MEDIA_TODO.md for the download commands that produce the source files.

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$src = "scripts/source/media"
$out = "public/media"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "ffmpeg was not found on your PATH."
  Write-Host "Install it with: winget install Gyan.FFmpeg"
  exit 1
}

if (-not (Test-Path $src)) {
  Write-Host "Missing $src - download the originals first (MEDIA_TODO.md)."
  exit 1
}

New-Item -ItemType Directory -Force -Path $out | Out-Null

function Convert-Image([string]$name, [string]$target, [int]$width, [int]$quality) {
  $source = Join-Path $src $name
  if (-not (Test-Path $source)) {
    Write-Host "  skip (missing source): $name"
    return
  }
  $destination = Join-Path $out $target
  Write-Host "  $target (${width}px, q$quality)"
  & ffmpeg -hide_banner -loglevel error -y -i $source -vf "scale=${width}:-2:flags=lanczos" -c:v libwebp -quality $quality -compression_level 6 $destination
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed on $name" }
}

function Convert-Video([string]$name, [string]$target, [int]$width) {
  $source = Join-Path $src $name
  if (-not (Test-Path $source)) {
    Write-Host "  skip (missing source): $name"
    return
  }
  $destination = Join-Path $out $target
  Write-Host "  $target (${width}px, h264 crf 27)"
  & ffmpeg -hide_banner -loglevel error -y -i $source -vf "scale=${width}:-2:flags=lanczos" -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -an -movflags +faststart $destination
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed on $name" }
}

Write-Host "Images:"
Convert-Image "plate.webp"              "story-poster.webp"       1920 80
Convert-Image "foreground.webp"         "story-foreground.webp"   1920 80
Convert-Image "rock.webp"               "rock.webp"               1200 80
Convert-Image "solution-chat.webp"      "solution-chat.webp"      1400 80
Convert-Image "solution-teammates.webp" "solution-teammates.webp" 1400 80
Convert-Image "hero-grid-poster.webp"   "hero-grid-poster.webp"   1600 78
Convert-Image "footer-poster.png"       "footer-poster.webp"      1600 78

Write-Host "Videos:"
Convert-Video "hero-grid.mp4" "hero-grid.mp4" 960
Convert-Video "footer.mp4"    "footer.mp4"    1280

Write-Host ""
Write-Host "Done. Files in $out"
