# Tumbli 0.1.4: update teaser (9:16, about 25 s)

A short teaser for what's new in 0.1.4, released on the Microsoft Store on **Monday, November 23, 2026**.
Only Tumbli's real app footage this time (no Google Flow): every shot is recorded from the app, the
same way as the first ad (`scripts/make-ad-clips.mjs`), inside the same laptop-screen frame.

Export: 1080×1920, 30 fps, the first ad's music style (upbeat, ~118 BPM) with a soft "bloop" on each
Tumbli moment. The voice-over is cut into its phrases at the pauses and each one placed on its shot.

## Voice-over (ElevenLabs)

Same voice as the first ad. Generate it as **one take**, the lines below with a short pause between
them (a blank line, or `<break time="0.6s" />` if the model supports it). Save it as
`store-assets/teaser/source/voice over.mp3`.

> Tumbli just got an update.
>
> Pick Auto, and Tumbli times your reminders, so you hit your goal before the day ends.
>
> Taking medicine or vitamins? Tumbli reminds you of those too.
>
> Need more space? Tuck Tumbli into the edge of your screen. It peeks out when it's time.
>
> Back from a break? Log what you had while you were away.
>
> The new Tumbli. Free update, November twenty-third.

(About 24 s at a natural pace. "November twenty-third" is spelled out so it's read as a date.)

## Shot list

| # | Time | Footage | What we see | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–2.4 | REAL | Tumbli pops up the "✨ Updated to 0.1.4 · What's new in Tumbli" bubble | **Big update!** |
| 2 | 2.4–7.8 | REAL | Settings: the pointer clicks **Auto** in "Remind me every", the hint appears ("about every 55 min right now"); cut to Tumbli's water reminder | **Auto reminders** |
| 3 | 7.8–11.9 | REAL | "Time for your Vitamin D" bubble, the pointer clicks **Taken**, Tumbli cheers "Nice! 💊" | **Medicine reminders** |
| 4 | 11.9–17.4 | REAL | The pointer drags Tumbli into the screen edge: it tucks half in and leans out; a reminder comes and it pops all the way out | **Peek mode** |
| 5 | 17.4–20.9 | REAL | Welcome back check-in: "Away for about 2 hours", the pointer picks **2** glasses, **Taken**, **Done**; Tumbli gulps | **Welcome back** |
| 6 | 20.9–25.0 | End card | Tumbli wordmark, Tumbli waving, **Update arrives Nov 23**, "on the Microsoft Store" | **Update arrives Nov 23** |

## Posting

- Caption ends with the date ("Update arrives Monday, Nov 23") and the Store link
  https://apps.microsoft.com/detail/9N6798TPR3KX (the free app is already there; the update lands on the 23rd).
- No AI-generated people this time, so no "AI-generated" label is needed for the footage (the voice is
  ElevenLabs: say so in the caption, as before).
