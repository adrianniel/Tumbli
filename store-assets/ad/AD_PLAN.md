# Tumbli: portrait ad (9:16, about 25 s)

Two kinds of footage, cut together in an editor (CapCut, Premiere, Clipchamp...):

- **[REAL]**: Tumbli's real animations, recorded from the app (`npm run ad-clips`, see the bottom).
  Never let an AI redraw Tumbli: its look and motions have to match the app people install.
- **[FLOW]**: people and desks, made in Google Flow (Veo). Tumbli does not appear in these.

Export: 1080×1920, 30 fps. Upbeat, light music (lo-fi or ukulele), around 110–120 BPM, with a soft
"bloop" on each Tumbli moment (the app's own reminder sound fits).

## Shot list

| # | Time | Footage | What we see | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–2.5 | FLOW | Close-up: Niel, a tired young Filipino man at his laptop late afternoon, rubs his eyes, an empty glass beside him | **Forgot to drink water again?** |
| 2 | 2.5–5.0 | REAL `01-idle` | Tumbli floats at the edge of a desktop, bobbing and blinking | **Meet Tumbli** |
| 3 | 5.0–8.5 | REAL `04-reminder` | Tumbli hops, waves and pops up "Time to sip!" | **It reminds you, gently** |
| 4 | 8.5–10.5 | FLOW | He smiles and takes a big sip from his sport bottle | (none) |
| 5 | 10.5–13.5 | REAL `03-drink` | Click "+": Tumbli gulps and the water inside rises | **Log it in one click** |
| 6 | 13.5–17.0 | REAL `05-goal` | Last glass: Tumbli celebrates the daily goal | **Hit your goal, every day** |
| 7 | 17.0–20.5 | REAL `07-outfits` | Party hat, sunglasses, headphones, crown, quick cuts on the beat | **Unlock outfits** |
| 8 | 20.5–22.5 | FLOW | Wide shot: bright, tidy desk, he works happily, bottle half full | **Stay hydrated, stay sharp** |
| 9 | 22.5–25.0 | End card | App icon + "Tumbli" + "Free on the Microsoft Store" | **Get it free on the Microsoft Store** |

Optional extras if the ad runs longer: `02-hover` (quick buttons appear), `06-fact` (water trivia bubble).

## Google Flow prompts (for the FLOW shots)

In Flow: new project, **Text to Video**, aspect ratio **9:16 (portrait)**, the best Veo model you have.
Generate 2–4 takes of each and keep the best.

The person is **Niel**, a real-looking Filipino man (live action, not animated), the same man in all three shots.
Tumbli calls him Niel in the real clips too ("Water break, Niel!"). Every prompt repeats his full
description word for word, so Veo keeps him looking the same:

> a Filipino man in his mid-20s with warm morena skin, short black hair with a clean side part,
> light stubble, wearing a light blue oversized button-up shirt

To keep him even more consistent: generate shot 1 first, pick the best take, and make shots 4 and 8 with
**Frames to Video**, using a still of him from shot 1 as the first frame (or add that still as an
**Ingredient**).

**Shot 1: thirsty and tired**
```
Vertical 9:16 cinematic close-up, live-action, photorealistic. A Filipino man in his mid-20s with warm morena skin, short black hair with a clean side part, light stubble, wearing a light blue oversized button-up shirt, sits at a home desk in a Manila condo in the late afternoon. Warm golden window light, soft blue glow from a laptop screen on his face. He leans back, rubs his tired eyes and sighs. Beside the laptop is an empty drinking glass. Shallow depth of field, gentle handheld movement, natural skin texture, natural colors. No text, no logos.
```

**Shot 4: the sip**
```
Vertical 9:16 medium close-up, live-action, photorealistic. The same Filipino man in his mid-20s with warm morena skin, short black hair with a clean side part, light stubble, wearing a light blue oversized button-up shirt, at the same home desk. He smiles, picks up a blue insulated sport bottle with a dark navy cap and carry loop, takes a big refreshing sip of water, and sets it down with a satisfied look. Warm afternoon light, shallow depth of field, slow smooth camera push-in, natural skin texture. No text, no logos.
```

**Shot 8: happy and focused**
```
Vertical 9:16 wide shot, live-action, photorealistic. A bright, tidy home office corner in a Manila condo with a small plant and soft sunlight through the window. The same Filipino man in his mid-20s with warm morena skin, short black hair with a clean side part, light stubble, wearing a light blue oversized button-up shirt, types happily on his laptop. A blue sport bottle with a navy cap, half full of water, stands next to the keyboard. Slow dolly-in, calm and positive mood, natural colors. No text, no logos.
```

Tips:
- If his face changes between shots, or faces or hands look off, regenerate; keep each shot short (2–3 s used).
- Platforms ask you to label realistic AI video: turn on the "AI-generated" label when you post on
  TikTok, Facebook/Instagram or YouTube.
- Add "no text, no logos" every time: Veo sometimes invents captions or brands.
- Don't ask Flow for Tumbli, a screen recording or the Windows UI; those come from the real clips.

## Voice-over (optional, about 22 s)

> Long day at the computer, and you forgot to drink water again?
> Meet Tumbli. It lives on the edge of your screen and reminds you, gently.
> One click when you drink, and Tumbli fills up with you.
> Hit your goal, keep your streak, and unlock outfits along the way.
> Tumbli. Free on the Microsoft Store.

## Real clips

`npm run ad-clips` (with `npm run dev` running) records Tumbli from the real app into
`store-assets/ad/clips/`, each in two versions:

- `*-desk.mp4`: Tumbli on a dark desktop with the taskbar, ready to use as is
- `*-green.mp4`: Tumbli on a green screen, to key over a Flow shot (CapCut: Cutout › Chroma key)

Reference images (transparent PNG) for thumbnails and the end card: `tumbli-idle.png`, `tumbli-empty.png`,
`tumbli-crown.png`, `tumbli-sunglasses.png`, `tumbli-app-icon.png`.
