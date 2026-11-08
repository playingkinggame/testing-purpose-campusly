# MEDIA_TODO — self-hosting the landing page assets

The landing page no longer calls any third-party CDN at runtime. Every image and
video now comes from this repo:

- `public/media/` — posters, photos, hero grid video, footer video
- `public/frames/` — 121 story frames at 1600px (desktop + retina)
- `public/frames-sm/` — 121 story frames at 960px (phones, low-memory, save-data)

All ten files below have **already been downloaded, converted and wired up** in
this workspace. This file is the record of where they came from, plus the exact
commands to regenerate them if the artwork changes.

`scripts/source/` is git-ignored: it holds the large originals and the 14 MB
story clip, which are only needed when regenerating.

---

## 1. Download table

| # | What | Original URL | Local target |
|---|------|--------------|--------------|
| 1 | Story source video (used only to generate frames) | `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261106_025717_906b686d-9a9a-4dea-bab4-ae2454f8390e.mp4` | `scripts/source/story.mp4` |
| 2 | Story poster plate | `https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_031618_8ce6dca1-972d-429d-8d13-bf0691c37848.png&w=2400&q=88` | `public/media/story-poster.webp` (1920w) |
| 3 | Foreground cut-out (fern / island edge) | `https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_031657_baaa3380-5ece-482a-a623-a1838fd7653c.png&w=2400&q=90` | `public/media/story-foreground.webp` (1920w) |
| 4 | Moss rock (used twice) | `https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_025635_82593f6a-1cf7-41c1-94ac-96fb89ebfd1a.png&w=2400&q=85` | `public/media/rock.webp` (1200w) |
| 5 | Solutions card 1 + 3 artwork | `https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_025630_9a37a1e0-2547-4973-8160-c75205993914.png&w=1400&q=82` | `public/media/solution-chat.webp` (1400w) |
| 6 | Solutions card 2 artwork | `https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_025545_b003e5cc-e68f-4fee-b686-c217a5d81eea.png&w=1400&q=82` | `public/media/solution-teammates.webp` (1400w) |
| 7 | Hero 5×2 reel grid video | `https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/04fd3d5f-99d7-476e-98a4-46c08518ffb3.mp4` | `public/media/hero-grid.mp4` (960w, H.264, crf 27, faststart, no audio) |
| 8 | Hero grid poster | `https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/b7ebb74a-8c8a-4f7e-8f80-55e2d74ecd05.webp` | `public/media/hero-grid-poster.webp` (1600w) |
| 9 | Footer meadow video | `https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/4d01c727-d9c5-47c8-a778-35a451ffd39f.mp4` | `public/media/footer.mp4` (1280w, H.264, crf 27, faststart, no audio) |
| 10 | Footer poster | `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261014_121838_c97d0940-f430-4304-8573-4f47ee44f447.png` | `public/media/footer-poster.webp` (1600w) |

Generated (not in the table above):

| Output | Built from |
|--------|-----------|
| `public/frames/f_000.webp … f_120.webp` (1600×904) | item 1 |
| `public/frames-sm/f_000.webp … f_120.webp` (960×542) | item 1 |
| `public/frames/manifest.json` (`{ count, width, height }`) | item 1 |

---

## 2. One-time download commands

Run from the project root. These are the same URLs as the table.

```bash
mkdir -p scripts/source/media

# 1. story video (14 MB, only needed to generate frames)
curl -L "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261106_025717_906b686d-9a9a-4dea-bab4-ae2454f8390e.mp4" \
  -o scripts/source/story.mp4

# 2. poster plate
curl -L "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_031618_8ce6dca1-972d-429d-8d13-bf0691c37848.png&w=2400&q=88" \
  -o scripts/source/media/plate.webp

# 3. foreground cut-out
curl -L "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_031657_baaa3380-5ece-482a-a623-a1838fd7653c.png&w=2400&q=90" \
  -o scripts/source/media/foreground.webp

# 4. moss rock
curl -L "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_025635_82593f6a-1cf7-41c1-94ac-96fb89ebfd1a.png&w=2400&q=85" \
  -o scripts/source/media/rock.webp

# 5. solutions card 1 + 3
curl -L "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_025630_9a37a1e0-2547-4973-8160-c75205993914.png&w=1400&q=82" \
  -o scripts/source/media/solution-chat.webp

# 6. solutions card 2
curl -L "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_025545_b003e5cc-e68f-4fee-b686-c217a5d81eea.png&w=1400&q=82" \
  -o scripts/source/media/solution-teammates.webp

# 7. hero grid video
curl -L "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/04fd3d5f-99d7-476e-98a4-46c08518ffb3.mp4" \
  -o scripts/source/media/hero-grid.mp4

# 8. hero grid poster
curl -L "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/b7ebb74a-8c8a-4f7e-8f80-55e2d74ecd05.webp" \
  -o scripts/source/media/hero-grid-poster.webp

# 9. footer video
curl -L "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/4d01c727-d9c5-47c8-a778-35a451ffd39f.mp4" \
  -o scripts/source/media/footer.mp4

# 10. footer poster (5.4 MB PNG)
curl -L "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261014_121838_c97d0940-f430-4304-8573-4f47ee44f447.png" \
  -o scripts/source/media/footer-poster.png
```

Windows users can paste the same `curl` lines into PowerShell (curl ships with
Windows 10+), or use `Invoke-WebRequest -Uri "<url>" -OutFile "<file>"`.

---

## 3. Build the frames and media

```bash
# macOS / Linux / Git Bash on Windows
bash scripts/extract-frames.sh
bash scripts/optimize-media.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/extract-frames.ps1
powershell -ExecutionPolicy Bypass -File scripts/optimize-media.ps1
```

`extract-frames` writes both frame folders plus `manifest.json`. `optimize-media`
converts the downloads into the seven images and two videos in `public/media/`.

The scripts need `ffmpeg` on your PATH:

- macOS: `brew install ffmpeg`
- Windows: `winget install Gyan.FFmpeg` (then open a new terminal)
- Ubuntu/Debian: `sudo apt install ffmpeg`

Expected result: **121 frames** per folder (the clip is 5.04 s at 24 fps) and a
`public/frames` total of roughly 9 MB, `public/frames-sm` roughly 4.5 MB.

---

## 4. If the story looks static

- Open DevTools → Network and check that `/frames/f_000.webp` returns **200**.
  A 404 means the frames were never generated: run `extract-frames`.
- `/frames/manifest.json` must exist. The page reads its `count` at boot, so a
  different clip length is fine as long as the frames match the manifest.
- The story never shows a blank canvas: if frames are missing it keeps the
  poster plate and the copy beats keep working.
