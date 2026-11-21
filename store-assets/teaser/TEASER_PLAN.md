# Tumbli 0.1.4: update teaser (9:16, about 28 s)

A teaser that introduces the new version and gives each new feature its own moment, released on
the Microsoft Store on **Monday, November 23, 2026**. Only Tumbli's real app footage (no Google
Flow): every shot is recorded from the app, the same way as the first ad
(`scripts/make-ad-clips.mjs`), inside the same laptop-screen frame.

Export: 1080×1920, 30 fps, the first ad's music style (upbeat, ~118 BPM) with a "bloop" on each
Tumbli moment and a whoosh on each feature title. The voice-over is cut into its phrases at the
pauses and each one is placed on its shot.

## Voice-over (ElevenLabs v3)

Same voice as the first ad. The [tags] are ElevenLabs v3 audio tags for the delivery. Generate it
as **one take**, with the blank lines as short pauses. Save it as
`store-assets/teaser/source/voice over.mp3`. The version number is never said: it is on screen
(the "v0.1.4" badge and the update bubble).

```
[excited, warm] Introducing... the new Tumbli!

[curious, playful] So, what's new?

[upbeat] First up: Auto reminders. Tumbli paces your water breaks, so you always hit your goal before the day ends.

[warm, caring] Next: medicine reminders. Add your meds or vitamins, and Tumbli reminds you right on time.

[playful] Then there's Peek. Tuck Tumbli into the edge of your screen... [softly] and it pops out when it's time to drink.

[friendly] And when you're back from a break, Tumbli welcomes you back, so you can log what you had.

[excited, smiling] Get the new Tumbli update on November twenty-third. [warm] Stay hydrated!
```

About 27 s at a natural pace. The date is spelled out so it's read as a date.

## Shot list

| # | Time | Footage | What we see | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.6 | REAL + graphics | Tumbli hops in and waves; the Tumbli wordmark lands next to it with a "v0.1.4" badge | **Introducing the new Tumbli** · v0.1.4 |
| 2 | 3.6–5.0 | REAL | Tumbli pops up "✨ Updated to 0.1.4 · What's new in Tumbli" | **What's new?** |
| 3 | 5.0–10.8 | REAL | Title card **01 Auto reminders**, then Settings: the pointer clicks **Auto**, the hint shows "about every 55 min right now"; cut to the water reminder popping up | **Auto reminders** · hit your goal, every day |
| 4 | 10.8–16.0 | REAL | Title card **02 Medicine reminders**, then "Time for your Vitamin D": the pointer clicks **Taken**, Tumbli cheers "Nice! 💊"; a glimpse of the Medicines card with today's doses ticked | **Medicine reminders** · right on time |
| 5 | 16.0–21.8 | REAL | Title card **03 Peek**, then the pointer drags Tumbli into the screen edge: it tucks half in and leans out; a reminder comes and it pops all the way out | **Peek** · out of the way, never gone |
| 6 | 21.8–26.4 | REAL | Title card **04 Welcome back**, then the check-in: "Away for about 2 hours", the pointer picks **2** glasses, **Taken**, **Done**; Tumbli gulps | **Welcome back** · log what you had |
| 7 | 26.4–30.0 | End card | Tumbli waving, the wordmark, **Get the new Tumbli update**, **November 23**, "on the Microsoft Store" | **Get the new Tumbli update · Nov 23** |

## Posting

- Caption ends with the date ("The update lands Monday, Nov 23") and the Store link
  https://apps.microsoft.com/detail/9N6798TPR3KX (the free app is already there; the update arrives on the 23rd).
- No AI-generated people this time, so the footage needs no "AI-generated" label; mention that the
  voice is made with ElevenLabs, as before.
