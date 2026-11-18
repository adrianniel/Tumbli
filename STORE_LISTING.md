# Tumbli: Microsoft Store listing

Copy-paste material for the Partner Center submission. Fields marked [YOU] need your input.

## Product name

**Tumbli** (Store title can be "Tumbli – Water Reminder" if the plain name is taken)

## Category

- Category: **Health & fitness**
- Subcategory: none needed

## Short description (max 100 characters)

> A cute floating water bottle that reminds you to drink water while you work or study.

## Description

> Tumbli is a little sport bottle that floats on your desktop and helps you stay hydrated through long days at the computer.
>
> Set a daily goal (8 glasses by default) and Tumbli fills up as you drink. Every so often it hops, waves and pops up a friendly reminder. One click logs a glass, snoozes, or skips.
>
> Tumbli is made to stay out of your way:
> • It only reminds you during your active hours
> • It stays quiet while you're away from the keyboard
> • It hides during fullscreen games, videos and presentations
> • Pause it for an hour or until tomorrow from the tray icon
>
> Track your progress with daily streaks and a 7-day history. No account, no ads, no tracking: everything stays on your PC.

## Features (up to 20, each max 200 characters)

1. A cute animated water bottle that floats on your desktop
2. Fills up as you drink toward your daily goal
3. Gentle reminders every 15 minutes to 2 hours
4. Log a glass, snooze or skip with one click
5. Only reminds you during your active hours
6. Stays quiet when you're away and hides during fullscreen apps
7. Pause reminders for an hour or until tomorrow
8. Daily streaks and a 7-day history chart
9. Starts with Windows (optional)
10. Light and dark mode
11. No account, no ads, no data collection

## Search terms (max 7)

water reminder, hydration, drink water, water tracker, health, break reminder, desktop widget

## Screenshots

Upload in this order from `store-assets/screenshots/` (1920×1080 PNG):

1. `1-meet-tumbli.png`: the intro, Tumbli as a tumbler just like yours
2. `2-reminder.png`: a reminder on the desktop
3. `3-your-plan.png`: the personal plan from the hydration check
4. `4-progress.png`: the dashboard with the week chart
5. `5-outfits.png`: outfits earned through achievements

They're rendered from the real app UI: run `npm run dev`, then `npm run screenshots`.

## Store logos

Partner Center uses the icons inside the MSIX package. If it asks for a separate 300×300 Store logo, use `src-tauri/icons/Square310x310Logo.png`.

## Privacy policy URL

Tumbli collects no personal data, so a privacy policy is optional, but having one helps reviewers and users.
The policy is in `docs/privacy.html`. Host it with GitHub Pages (Settings › Pages › Deploy from branch › `main` / `/docs`),
which on a private repo needs a paid GitHub plan; or make the repo public; or host the file anywhere public. [YOU]

URL: `https://<your-github-username>.github.io/Tumbli/privacy.html` [YOU]

## Support contact

**adrianniel.garig@gmail.com** (shown on the Store page). It's the same address as
`SUPPORT_EMAIL` in `src/config.ts`, which the in-app **Send feedback** form opens in the
user's email app; change both together.

## Store ID (for the in-app rating prompt)

After 3 days of use Tumbli asks for a rating and opens the Store review page. Put the app's
**Store ID** (Partner Center › Product management › Product identity, e.g. `9NBLGGH4R32N`) in
`STORE_PRODUCT_ID` in `src/config.ts`. Until then the prompt opens a Store search for "Tumbli". [YOU]

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

Version 0.1.0: first release.
