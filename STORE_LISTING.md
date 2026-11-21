# Tumbli: Microsoft Store listing

Copy-paste material for the Partner Center submission. Fields marked [YOU] need your input.

## Product name

**Tumbli** (Store title can be "Tumbli – Water Reminder" if the plain name is taken)

## Category

- Category: **Health & fitness**
- Subcategory: none needed

## Short description (max 100 characters)

> A cute water bottle that floats on your desktop and reminds you to drink water while you work.

## Description

> Meet Tumbli, a little sport bottle with a face that lives at the edge of your screen and keeps you hydrated through long days at the computer.
>
> A 30-second check-in looks at your age, weight, activity and weather and suggests a daily goal that fits you. Track by the glass, or by your own tumbler or bottle: Tumbli mirrors it, so when yours is empty, Tumbli is too.
>
> Tumbli fills up as you drink. Every so often it hops, waves and pops up a friendly reminder. Log a drink, snooze or skip in one click, or press Ctrl+Alt+W from any app without touching the mouse.
>
> Pick how often to be reminded, or leave it on Auto: Tumbli spaces the reminders so you reach your goal before your day ends.
>
> Taking medicine or vitamins? Add them with their times and Tumbli reminds you at each one, then ticks off today's doses.
>
> Want it out of the way? Drag Tumbli past the screen edge and it peeks out from the side, coming out only when it has something to say. Back from a break or a closed lid, it tells you how long you were away and lets you log a drink.
>
> Tumbli is made to stay out of your way:
> • It only reminds you during your active hours
> • It stays quiet while you're away from the keyboard
> • It hides during fullscreen games, videos and presentations
> • Pause it for an hour or until tomorrow from the tray icon
>
> Keep your streak going and unlock achievements, plus outfits for Tumbli: a party hat, a bow tie, sunglasses, headphones and a crown. Every Monday it shows how last week went. Click Tumbli anytime for a water fact or a bit of trivia.
>
> Dark mode by default, light mode with one switch. No account, no ads, no tracking: everything stays on your PC.
>
> Tumbli's goal is a general guide, not medical advice. If a doctor has told you how much to drink, follow that.

## Features (up to 20, each max 200 characters)

1. A cute animated water bottle that floats on your desktop and docks to the left or right edge of your screen
2. A personal daily goal from a 30-second check-in (age, weight, activity and weather)
3. Track by the glass, or by your own tumbler or bottle that Tumbli mirrors
4. Fills up as you drink toward your daily goal
5. Gentle reminders every 15 minutes to 2 hours, or on Auto: paced so you reach your goal before your day ends
6. Log a drink, snooze or skip with one click
7. Log a drink from any app with a keyboard shortcut (Ctrl+Alt+W)
8. Stays quiet while you're away and hides during fullscreen games, videos and slides
9. Pause reminders for an hour or until tomorrow from the tray icon
10. Daily streaks, today at a glance and a 7-day history chart
11. A recap of your week every Monday
12. Achievements that unlock outfits for Tumbli
13. Water facts and trivia: just click Tumbli
14. Dark mode by default, light mode with one switch
15. Starts with Windows (optional)
16. Send feedback right from the app
17. No account, no ads, no data collection
18. Medicine and vitamin reminders at the times you set, with today's doses ticked off
19. Drag Tumbli past the screen edge and it peeks out from the side until it has something to say
20. Back after time away, Tumbli tells you how long you were gone and how many water breaks you missed

## Search terms (max 7)

water reminder, hydration, drink water, water tracker, health, break reminder, desktop widget

## Screenshots

Upload in this order from `store-assets/screenshots/` (3840×2160 PNG):

1. `1-meet-tumbli.png`: Tumbli docked on the desktop, with its quick actions
2. `2-reminder.png`: a reminder next to a work calendar
3. `3-your-plan.png`: the personal plan from the hydration check
4. `4-progress.png`: the dashboard with the week chart
5. `5-outfits.png`: an achievement unlocking an outfit, and all the outfits
6. `6-light-mode.png`: light mode with the weekly recap

Each one shows the real app UI on a Windows-style desktop (taskbar, tray icon, other
windows). Shots 1–5 are in dark mode, Tumbli's default; shot 6 shows light mode (a switch in Settings). To regenerate: run `npm run dev`, then `npm run screenshots`.

## Store logos

Partner Center uses the icons inside the MSIX package. If it asks for a separate 300×300 Store logo, use `src-tauri/icons/Square310x310Logo.png`.

## Privacy policy URL

**https://adrianniel.github.io/Tumbli/privacy.html**

Hosted with GitHub Pages from `docs/` on `main` (edit `docs/privacy.html` and push to update it).
Tumbli collects no personal data, so the policy is short, but having one helps reviewers and users.

## Support contact

**adrianniel.garig@gmail.com** (shown on the Store page). It's the same address as
`SUPPORT_EMAIL` in `src/config.ts`, which the in-app **Send feedback** form opens in the
user's email app; change both together.

## Store ID (for the in-app rating prompt)

After 3 days of use Tumbli asks for a rating and opens the Store review page. The app's
**Store ID** is **9N6798TPR3KX** (Partner Center › Product management › Product identity), set as
`STORE_PRODUCT_ID` in `src/config.ts`. The package identity is in `packaging/msix/identity.json`.

## Age rating

Fill in the IARC questionnaire: no violence, no user-generated content, no communication between users,
no location sharing, no purchases. Expected rating: **3+ / Everyone**.

## Pricing and availability

- Price: Free [YOU: or set a price]
- Markets: all

## Notes for certification

> Tumbli is a Tauri (WebView2) desktop app packaged as MSIX. It declares the runFullTrust
> capability because it is a classic Win32 desktop app; it uses it to show an always-on-top
> floating widget, read idle time (GetLastInputInfo) and fullscreen state
> (SHQueryUserNotificationState) so reminders don't interrupt the user, and to show a tray icon.
> It makes no network requests. Start with Windows is a package StartupTask, off by default
> unless the user turns it on in the app.

## What's new (for updates)

Version 0.1.4 (paste into "What's new in this version"):

> New: Auto reminders that pace themselves to your goal, medicine reminders, a peek mode at the screen edge, and a welcome back after time away.

(0.1.4: an "Auto" choice in "Remind me every" (the default for new users), and a Medicines card in
Settings: add a medicine with its times, Tumbli asks at each one, today's doses can be ticked off.
Peek: drag past the screen edge to tuck Tumbli half in. Welcome back after 30+ min away.
0.1.3: a new "Remind me every" now takes effect right away, and settings show when the next
reminder comes. 0.1.2: no title bar above the speech bubbles, a Tumbli dialog for Reset today.)

Version 0.1.1: first release on the Store (0.1.0 was withdrawn before it was published).
