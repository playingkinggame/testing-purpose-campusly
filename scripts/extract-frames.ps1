# Extract the scroll-story video into two WebP frame sequences.
#
#   powershell -ExecutionPolicy Bypass -File scripts/extract-frames.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/extract-frames.ps1 path\to\other.mp4
#
# Writes:
#   public\frames\f_000.webp ...    1600px wide
#   public\frames-sm\f_000.webp ...  960px wide
#   public\frames\manifest.json      { count, width, height }

param(
  [string]$Source = "scripts/source/story.mp4"
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$fullDir = "public/frames"
$smallDir = "public/frames-sm"
$fullWidth = 1600
$smallWidth = 960

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "ffmpeg was not found on your PATH."
  Write-Host "Install it with: winget install Gyan.FFmpeg"
  exit 1
}

if (-not (Test-Path $Source)) {
  Write-Host "Missing source video: $Source"
  Write-Host "Download it first - see MEDIA_TODO.md item 1."
  exit 1
}

New-Item -ItemType Directory -Force -Path $fullDir, $smallDir | Out-Null
Remove-Item -Path (Join-Path $fullDir "f_*.webp") -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $smallDir "f_*.webp") -ErrorAction SilentlyContinue

Write-Host "Extracting $fullWidth px frames from $Source ..."
& ffmpeg -hide_banner -loglevel error -y -i $Source -vf "scale=${fullWidth}:-2:flags=lanczos" -c:v libwebp -quality 78 -compression_level 6 -start_number 0 (Join-Path $fullDir "f_%03d.webp")
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed while extracting full-size frames." }

Write-Host "Extracting $smallWidth px frames ..."
& ffmpeg -hide_banner -loglevel error -y -i $Source -vf "scale=${smallWidth}:-2:flags=lanczos" -c:v libwebp -quality 74 -compression_level 6 -start_number 0 (Join-Path $smallDir "f_%03d.webp")
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed while extracting small frames." }

$count = (Get-ChildItem $fullDir -Filter "f_*.webp").Count
$smallCount = (Get-ChildItem $smallDir -Filter "f_*.webp").Count

$firstFrame = Join-Path $fullDir "f_000.webp"
$probe = (& ffmpeg -hide_banner -i $firstFrame 2>&1 | Out-String)
$match = [regex]::Match($probe, "(\d{2,5})x(\d{2,5})")
$width = if ($match.Success) { [int]$match.Groups[1].Value } else { $fullWidth }
$height = if ($match.Success) { [int]$match.Groups[2].Value } else { 0 }

$manifest = [ordered]@{ count = $count; width = $width; height = $height }
$json = $manifest | ConvertTo-Json
$manifestPath = Join-Path $fullDir "manifest.json"
[System.IO.File]::WriteAllText((Resolve-Path $fullDir).Path + "\manifest.json", $json)

Write-Host ""
Write-Host "Done."
Write-Host "  $fullDir : $count frames (${width}x${height})"
Write-Host "  $smallDir : $smallCount frames"
Write-Host "  manifest  : $manifestPath"
Write-Host ""
Write-Host "The page reads the manifest at boot, so a different frame count is fine."
