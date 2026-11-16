# Good Life Tracker: App Plan

*Version 0.3, 16 Nov 2026: approach decided (Home Screen web app), decisions in section 12, final question set in section 13*

## 1. Goal

A personal iPhone app that replaces the "Good Life Tracker" spreadsheet. It should:

- make the daily check-in fast enough that you actually do it (target: **under 90 seconds**)
- keep all data **on your phone**, with no account, no cloud backend and no third party
- show you patterns over time (per question, per category, and across categories)
- make it easy to change the questions themselves, since we'll revise them in step 2 and probably again later

## 2. What the spreadsheet gives us

| Aspect | Current state in the sheet |
|---|---|
| Structure | 10 categories, 27 questions |
| Frequency | 20 daily, 7 weekly (family, community, finances, learning, service, entertainment) |
| Scales | 25 × 1–5 rating, 2 × hours (sleep, work) |
| Time axis | One column per day, 1 Feb – 28 Jul 2026 |
| Data | Empty template, so there's nothing to migrate |

**Categories:** Overall wellbeing & actions · Faith · Relationships & community · Mental health · Physical health · Work · Purpose & engagement · Achievement & growth · Character & virtue · Entertainment

**What this means for the app:**

1. **The questions are data, not code.** The question list lives in the app's database and can be edited, reordered, archived or added to from inside the app. Step 2 will change the list, and the app shouldn't need to be rebuilt each time.
2. **The app needs several scale types.** It must support 1–5, hours and yes/no (several questions like "Did I work out?" are really yes/no), with room for a number or short text later.
3. **Daily and weekly questions are separate flows.** Daily questions come up every morning, rating the previous day. Weekly questions come up once a week (for example Sunday), so they don't pad the daily check-in.
4. **Archive questions instead of deleting them.** If a question is retired, its history stays visible.

## 3. How to run it on your iPhone: the options

"Running locally" can mean two things. Either the **data** stays on the phone, or the **app code** is installed on the phone without the App Store. All options below keep the data on the phone. They differ in how the code gets there and what iOS features you get.

| | **A. Web app on Home Screen (PWA)** | **B. Native app, free Apple ID** | **C. Native app, paid developer account** |
|---|---|---|---|
| What it is | Web page installed via *Share → Add to Home Screen*. Opens full-screen like an app | Swift/SwiftUI app installed from Xcode | Same as B |
| Needs a Mac? | No | Yes (Xcode) | Yes |
| Cost | €0 | €0 | ~€99/year |
| Re-install needed? | Never | **Every 7 days**: the app stops opening until you re-run it from Xcode (data is kept) | Once a year |
| Works offline | Yes (service worker) | Yes | Yes |
| Data storage | IndexedDB in the installed web app | SwiftData / SQLite on device | Same |
| Daily reminder notification | Not on its own. Web Push needs a server, so use an iOS Reminder or Shortcut instead | Yes, local notifications | Yes |
| Apple Health (auto sleep hours, workouts) | No | Yes (HealthKit) | Yes |
| Home Screen widget | No | Yes | Yes |
| Speed to change things | Very fast: edit, deploy, refresh | Rebuild in Xcode | Rebuild, or TestFlight |

Notes behind this table:

- Free signing limits: a free Personal Team gives 7-day provisioning profiles, up to 3 apps per device, and own devices only. A paid membership extends development profiles to about a year.
- Since iOS 26, any site added to the Home Screen opens as a standalone web app by default.
- Safari can delete website data after 7 days without use. **Home Screen web apps are exempt from that rule**, so the app must be used from the Home Screen icon, not from a Safari tab. Data in Safari and in the installed app is also stored separately.

### Recommendation

**Start with option A (PWA). Keep option B/C as a later upgrade path.**

Why:

- **The questions will change a lot in the first weeks** (step 2 is about deciding exactly that). A web app is the fastest to iterate on: change, deploy, pull to refresh.
- No Mac, no Xcode and no weekly re-install, so it works today on any iPhone.
- The data model (section 5) and JSON export are designed to be portable. If you later want Apple Health sleep data, real notifications or a widget, a native SwiftUI version can import the full history.

**The one real risk with a PWA is storage.** The app's data lives in iOS's web storage, so the app has to:
- always be opened from the Home Screen icon
- run a **regular backup export** (section 7), which isn't optional

> **Decided (16 Nov):** Build as a Home Screen web app (option A). A native SwiftUI version (B/C) stays an option for later, since a Mac is available. The trigger to switch would be wanting reminders without a server, automatic sleep data from Apple Health, or a widget.

## 4. Architecture (PWA)

```
┌──────────────────────────── iPhone ────────────────────────────┐
│  Home Screen icon → standalone web app (no Safari UI)          │
│                                                                │
│   UI (Preact + TypeScript)                                     │
│     ├─ Today (daily check-in)                                  │
│     ├─ Week (weekly check-in)                                  │
│     ├─ Insights (trends, heatmap, correlations)                │
│     └─ Settings (edit questions, export/import, reminders)     │
│                                                                │
│   Data layer (Dexie.js → IndexedDB)   ← all data stays here    │
│   Service worker (offline cache of the app code)               │
└────────────────────────────────────────────────────────────────┘
          ▲ app code only (HTML/JS/CSS), no personal data
┌─────────┴──────────┐
│ Static hosting     │  GitHub Pages or Cloudflare Pages (free, HTTPS)
└────────────────────┘
```

**Why the code still needs hosting:** iOS only installs a web app with offline support from an HTTPS address. A free static host serves the *code*. Your *entries* never leave the phone, since the app makes no network calls with your data.

**Stack**

| Layer | Choice | Reason |
|---|---|---|
| Build tool | Vite | Fast, simple, good PWA plugin |
| UI | Preact + TypeScript | Small and fast on mobile, React-like |
| Storage | Dexie.js over IndexedDB | Simple queries, schema migrations |
| Offline / install | `vite-plugin-pwa` (manifest + service worker) | Standard approach |
| Charts | uPlot or a small hand-written SVG | Lightweight |
| Styling | Plain CSS with iOS-like defaults, dark mode | No heavy framework needed |

**Development workflow (Mac + VS Code + Claude Code)**

1. Code lives in a GitHub repo, edited in VS Code with Claude Code.
2. `npm run dev` runs the app on the Mac for fast iteration. `npm run dev -- --host` makes it reachable from the iPhone on the same Wi-Fi, which is good for checking layout and touch targets. Installing and testing offline mode needs HTTPS, so it only works on the deployed version.
3. Every push to `main` builds and deploys automatically with GitHub Actions to GitHub Pages (or Cloudflare Pages).
4. Use a separate test profile or the Mac browser for experiments. The phone holds the real data.

## 5. Data model

```ts
// A question, which you can edit inside the app
Dimension {
  id: string
  category: string            // "Physical health"
  question: string            // "What was the quality of my sleep?"
  shortLabel: string          // "Sleep quality" (for charts)
  frequency: "daily" | "weekly"
  scale: "rating5" | "hours" | "yesno" | "number" | "text"
  anchors?: { 1: string, 3: string, 5: string }  // what 1/3/5 mean
  higherIsBetter: boolean     // false for stress, so charts color it correctly
  naLabel?: string            // e.g. "No work today" (stored as value null)
  min?: number; max?: number; step?: number      // for hours, e.g. 0–12 in 0.5 steps
  order: number
  active: boolean             // false = archived, history kept
  createdAt: string
}

// One answer
Entry {
  id: string
  dimensionId: string
  period: string              // "2026-11-16" (daily) or "2026-W47" (weekly)
  value: number | boolean | string | null   // null = skipped on purpose
  note?: string
  updatedAt: string
}

// Optional free-text reflection per day
DayNote { date: string, text: string }

Settings { weekStartsOn, weeklyCheckInDay, theme, lastBackupAt, schemaVersion }
```

- The app ships with the **final question set from section 13** as its seed list.
- **Sleep is stored on the wake-up date.** In the morning you answer for last night, so that sleep is linked to the day it affects (the day you'll rate tomorrow morning).
- `anchors` matter: a 1–5 scale is only comparable over time if "3" means the same thing every day (for example *1 = not at all, 3 = partly, 5 = fully*).
- `schemaVersion` plus Dexie migrations let the structure evolve without losing data.

## 6. Features

### MVP (version 1)

**Today screen (daily check-in)**
- One scrollable list grouped by category, with one big row of 1–5 tap targets per question. Hours use a stepper (±0.5), and yes/no is a toggle.
- Auto-save on every tap, with no "submit" button.
- A progress indicator ("14 / 20").
- A "Skip" option per question, separate from "not answered yet."
- **Morning mode (default):** before a cutoff time (default 12:00), the check-in opens on **yesterday**, with the title "How was yesterday?". After the cutoff it opens on today. The cutoff is adjustable in Settings, so evening check-ins also work if your preference changes.
- A date switcher for filling in any other missed day.
- An optional note field for the day.

**Weekly check-in**
- Appears on **Sunday** as a banner on the Today screen, and stays there until done (through Monday, for a morning check-in).
- Covers the weekly questions plus an optional "one thing that went well / one thing to change" reflection.

**Insights**
- **Heatmap** per question: a calendar grid coloured 1–5, which is the spreadsheet view but readable.
- **Trend line** per question and per category: 7-day rolling average plus a 4-week comparison.
- **Category scores**: average of each category's questions, shown as a weekly bar or radar view.
- **Completion rate**: how many days you checked in.

**Settings**
- Add, edit, reorder and archive questions, and change their scale and frequency.
- **Export**: full JSON backup, plus CSV in the same wide layout as your spreadsheet for Excel.
- **Import**: restore from a JSON backup.
- A backup reminder banner if the last export is more than 7 days old.

### Version 2

- **Correlations**: for example "on days with 7+ h sleep, your wellbeing averages 4.1 vs 3.2." Simple comparisons, not heavy statistics.
- **Streaks** for habit-type questions (morning routine, workout, spiritual practice).
- **Weekly review** screen: this week vs last week per category, plus your notes.
- **Focus questions**: pin 1–3 questions you're currently working on to the top.
- **Monthly reflection**: a short free-text prompt plus an auto-generated month summary.

### Later / native-only

- Automatic sleep hours and workouts from Apple Health (needs native).
- Local notification reminders and a Home Screen widget (needs native).
- Siri / Shortcuts quick logging.

## 7. Backup and privacy

- **No backend, no account, no analytics.** The app makes zero network requests with personal data.
- **Backup routine**: the Export button creates a JSON file → *Save to Files* → iCloud Drive folder "Good Life Tracker Backups." The app reminds you weekly. iCloud Drive keeps a copy even if the phone is lost.
- **Restore**: a fresh install → Import → choose the JSON file.
- Optional later: a single-file auto-backup using the share sheet, triggered as part of the weekly check-in.

## 8. Daily reminder without a server

A web app can't schedule its own local notifications. It can receive Web Push when installed on the Home Screen, but something on the internet has to send it.

**Now (MVP):** use iOS for the reminder.
- A recurring iOS Reminder, "Good Life check-in," every day at 07:30.
- A second recurring Reminder on Sundays: "Weekly check-in."
- Optional: a Shortcuts personal automation at 07:30 that shows a notification.

**Later (optional): real Web Push**
- The app asks for notification permission once, by tapping a button inside the installed app.
- A tiny scheduled service (for example a free Cloudflare Worker with a cron trigger) sends a generic "Time for your check-in" push at 07:30 daily and on Sundays.
- The service stores only the push subscription and the reminder times. It gets **no tracker data**: the notification text is generic, and your entries stay on the phone.
- About half a day of work. Worth it only if the iOS Reminder turns out not to be enough.

## 9. Installing it on your iPhone (step by step)

1. I build the app and push it to a GitHub repo. GitHub Pages or Cloudflare Pages (free) hosts it at an HTTPS address.
2. On the iPhone, open that address **in Safari**.
3. Tap **Share → Add to Home Screen → Add**.
4. **Always open it from the Home Screen icon.** That's what keeps the data persistent and separate from Safari.
5. The first time, open it once while online so it caches itself. After that it works fully offline.
6. Updates: when I deploy a new version, the app shows "Update available – tap to reload." Your data is unaffected.

## 10. Build plan

| Milestone | Content | Done when |
|---|---|---|
| **M0** Decide | Answer the open decisions (section 12), finish step 2 (question review) | Final question list with scales and anchors |
| **M1** Skeleton | Vite + Preact + Dexie + PWA setup, data model, seed questions, deploy | Installable on the iPhone, works offline |
| **M2** Check-in | Today screen, weekly check-in, date switcher, auto-save | 2 weeks of real use without friction |
| **M3** Safety | Export/import JSON, CSV export, backup reminder | Restore tested on a clean install |
| **M4** Insights | Heatmap, trends, category scores, completion | Can answer "how was my last month?" in 10 s |
| **M5** Iterate | Question editor polish, correlations, streaks, weekly review | Based on what 4 weeks of use showed |
| *(optional)* **M6** Web Push | Cloudflare Worker cron + push subscription for the 07:30 and Sunday reminders | Only if the iOS Reminder isn't enough |
| *(optional)* **M7** Native | SwiftUI + SwiftData port, HealthKit sleep, local notifications, widget, JSON import | Only if PWA limits become annoying |

## 11. Design principles for the check-in

- **Friction kills trackers.** The daily list has 18 questions, which should take 1.5–2 minutes with one-tap answers. After 4 weeks, look at completion and skip rates per question and trim anything you keep skipping.
- **One tap per question, thumb-reachable, with no typing required.**
- **Clear anchors on every scale**, shown small under the question.
- **No guilt UI.** Missing a day is fine, with no red streak breaks shouted at you.
- **Show value back quickly.** Even after one week, show a simple "your week" view so the habit feels worth it.

## 12. Decisions

| Topic | Decision | Status |
|---|---|---|
| Approach | Home Screen web app (PWA). Native possible later, since a Mac is available | Decided |
| Development | VS Code + Claude Code on the Mac, GitHub repo, auto-deploy | Decided |
| Daily check-in | Yes, daily | Decided |
| Check-in time | Morning, rating the previous day (cutoff 12:00, adjustable) | Tentative, test for 2 weeks |
| Weekly check-in | Sunday | Decided |
| Reminders | iOS Reminders at 07:30 daily and on Sunday; Web Push later if needed | Decided for MVP |
| Language of the app UI | English | Decided |

## 13. Question set (v1 seed)

Result of the review on 16 Nov 2026. Changes compared with the spreadsheet: Faith removed (no practices), journaling added, morning routine removed (no routine), stress changed to "how stressed," behavior questions changed to yes/no, friends moved to weekly, community and service merged, virtues removed.

### Daily: 18 questions (morning, rating yesterday; sleep is about last night)

| # | Category | Question | Scale | Anchors (1 · 3 · 5) |
|---|---|---|---|---|
| D1 | Overall wellbeing | What was my overall wellbeing? | 1–5 | Rough day · Okay · Great day |
| D2 | Overall wellbeing | Was I the person I want to be? | 1–5 | Not at all · Partly · Fully |
| D3 | Relationships | Did I love my partner well? | 1–5 | Neglectful or hurtful · Fine, nothing special · Intentionally loving |
| D4 | Mental health | How stressed did I feel? | 1–5, **lower is better** | Calm · Noticeable but manageable · Overwhelmed |
| D5 | Mental health | Did I journal or reflect? | Yes/no | Auto-ticked when the day note has a few sentences |
| D6 | Physical health | How did I feel physically? | 1–5 | Sick or exhausted · Normal · Energetic and strong |
| D7 | Physical health | How many hours did I sleep last night? | Hours, 0–12, 0.5 steps | |
| D8 | Physical health | How well did I sleep last night? | 1–5 | Restless, woke often · Average · Deep, woke rested |
| D9 | Physical health | Did I eat healthy? | 1–5 | Poorly · Mixed · Clean all day |
| D10 | Physical health | Did I work out? | Yes/no | |
| D11 | Work | Did I enjoy work? | 1–5, N/A = "No work today" | Dreaded it · Neutral · Loved it |
| D12 | Work | How many hours did I work? | Hours, 0–16, 0.5 steps | |
| D13 | Purpose & engagement | Did I experience meaning? | 1–5 | Felt pointless · Some meaning · Deeply meaningful |
| D14 | Purpose & engagement | Did I experience positive emotions? | 1–5 | Hardly any · Some · Lots of joy, gratitude, fun |
| D15 | Purpose & engagement | Did I feel engaged by what I was doing? | 1–5 | Bored or distracted · Partly · Absorbed, in flow |
| D16 | Achievement & growth | Did I have a sense of achievement? | 1–5 | None · Some progress · Strong sense of accomplishment |
| D17 | Achievement & growth | Did I achieve my daily goals? | 1–5, N/A = "No goals set" | None · About half · All of them |
| D18 | Character & virtue | Did I practice the habits I am building? | 1–5 | None · Some · All of them |

### Weekly: 6 questions (Sunday)

| # | Category | Question | Scale | Anchors (1 · 3 · 5) |
|---|---|---|---|---|
| W1 | Relationships | Did I love my family well? | 1–5 | Neglected them · Okay · Present and intentional |
| W2 | Relationships | Did I love my friends well? | 1–5 | Neglected them · Okay · Present and intentional |
| W3 | Character & virtue | Was I of service, generous, or did I contribute to my community? | 1–5 | Not at all · A little · Meaningfully |
| W4 | Work | Was I wise financially? | 1–5 | Careless or impulsive · Okay · Intentional, on plan |
| W5 | Achievement & growth | Was my mind stimulated / did I learn? | 1–5 | Nothing new · Some · Learned a lot |
| W6 | Entertainment | Was my engagement in hobbies & entertainment healthy? | 1–5 | Mindless scrolling or bingeing · Mixed · Intentional and restorative |

All anchors are first drafts and can be edited in the app's Settings.
| Question list | 18 daily and 6 weekly questions (section 13). Faith removed, morning routine and virtues cut, community and service merged | Decided |
