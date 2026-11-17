# Hero film

The homepage hero scrubs a video with scroll: scrolling down plays it forward, scrolling up rewinds it. Drop two files here:

| File | Used on | Suggested size |
|---|---|---|
| `hero.mp4` | Desktop and tablet | 1920 px wide, 16:9 |
| `hero-mobile.mp4` | Phones (optional; falls back to `hero.mp4`) | 900 px wide, 3:4 portrait crop |

Until `hero.mp4` exists, the site shows the still image hero, exactly as before. Nothing breaks.

## What footage works best
- **One continuous, slow camera move**, 6–10 seconds: a drone push-in over the entrance gate, a glide down the main avenue, or a rise over the clubhouse revealing the estate. Scroll will "play" it, so steady forward motion reads beautifully; fast cuts and shaky handheld don't.
- Golden-hour light matches the site palette.
- No audio is needed (it's stripped).

## Encode it for smooth scrubbing
Normal MP4s only store a full picture every few seconds, so jumping backwards stutters. Encode **all-intra** (every frame a keyframe). Files get larger, so keep the clip short.

Install ffmpeg once (Windows):

```bash
winget install Gyan.FFmpeg
```

Desktop cut:

```bash
ffmpeg -i drone.mp4 -an -t 8 -vf "scale=1920:-2,fps=24" -c:v libx264 -preset slow -crf 24 -g 1 -keyint_min 1 -pix_fmt yuv420p -movflags +faststart assets/video/hero.mp4
```

Phone cut (centre-cropped to portrait):

```bash
ffmpeg -i drone.mp4 -an -t 8 -vf "crop=ih*3/4:ih,scale=900:-2,fps=24" -c:v libx264 -preset slow -crf 26 -g 1 -keyint_min 1 -pix_fmt yuv420p -movflags +faststart assets/video/hero-mobile.mp4
```

Aim for roughly 4–8 MB (desktop) and 2–4 MB (phone). If a file is bigger, shorten `-t` or raise `-crf` by 2.

## Tuning the feel
In `assets/js/main.js`, find `const FILM`:
- `span`: how much scrolling the film takes (1.6 = 1.6 screen heights). Raise it for a slower, more cinematic pace.
- `chase`: how quickly the frame catches up with the scroll. Lower values feel floatier.
- `zoom`: the camera push-in layered on top of the film (1.22 = the frame grows 22% by the end). Set to 1 to turn it off.

## Previewing locally
`python -m http.server` ignores HTTP Range requests, so browsers refuse to seek the film and the still image stays. Use the range-aware server instead:

```bash
node .claude/serve.js 5189
```

Any real host (Netlify, Vercel, Apache, nginx, S3/CloudFront) supports Range requests, so this only matters locally.

## Current cut
`hero.mp4` / `hero-mobile.mp4` come from a Gemini-generated clip (`gemini_generated_video_0cc049a2.mp4`, 1280×720, 10 s): the camera pushes through foliage to reveal a modern villa at golden hour as a car comes up the driveway. Used whole, audio removed. The desktop cut is cropped to 1120×630 at (8, 45) and scaled back to 1280×720 to remove Gemini's sparkle mark in the bottom-right corner; the phone cut's centre crop already excludes it.

Earlier cuts are kept as backups. To switch to one, rename it to `hero.mp4` / `hero-mobile.mp4`:
- `hero-house.mp4` / `hero-house-mobile.mp4`: Pexels video 19120564 (free Pexels licence), a top-down drone shot reversed to descend onto a house and a car in its driveway.
- The cut from `DJI_0113_cinematic.mp4` (forest road toward the river bridges) is kept as `hero-drone.mp4` / `hero-drone-mobile.mp4`. To switch back, rename those to `hero.mp4` / `hero-mobile.mp4`.
