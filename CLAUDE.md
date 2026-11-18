# CLAUDE.md – Good Life Tracker

Personal iPhone check-in app, installed from Safari to the Home Screen (PWA). Plan and decisions: `good-life-tracker-app-plan.md`. It wins when in doubt.

## Rules

1. **The user's data never leaves the phone.** No backend, no accounts, no analytics, no network requests that carry entries. Only the app code is hosted.
2. **No third-party requests at runtime.** Fonts are self-hosted in `src/fonts/` (Newsreader + Inter, SIL OFL), icons are inline SVG. No CDNs.
3. **Never lose stored data.** Changes to the database structure go in a new `this.version(n)` block in `src/lib/db.ts`, with an `.upgrade()` where needed. Never edit an existing version. Bump `SCHEMA_VERSION`. Keep JSON backup/restore working.
4. **Questions are data.** Users edit them in Settings. `src/lib/seed.ts` only runs on a fresh install, so changing it doesn't touch existing phones.
5. **Never delete files, fonts, images or git history without asking.** If something looks obsolete, ask first.
6. **Patch, don't rewrite.** Make targeted edits to existing files.
7. **Ask before commit, push or deploy.** A push to `main` deploys to the public site automatically.
8. **No new dependencies without asking.**
9. **Report honestly.** Say what changed, what was verified, and what wasn't.

## Design

Dark editorial + neon sunset (dark-only). The tokens are CSS variables at the top of `src/styles.css`. Colour is a highlight, never decoration. Serif headlines (Newsreader), Inter for the UI, square cards, 1.5px line icons. Rating scale: 1 = peach (bad), 3 = slate, 5 = electric blue (good). `higherIsBetter: false` flips it.

## Commands

Node comes from nvm and isn't on the default PATH: run `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"` first.

    npm run dev        # http://localhost:5173  (?demo = separate DB with fake data; #week/#insights/#settings open a tab)
    npm test           # vitest: dates, storage, backup, stats
    npm run build      # type-check + production build
    npm run icons      # regenerate PNG/SVG icons (scripts/gen-icons.mjs)

Run `npm test` and `npm run build` after every code change.

## Deploy

Repo: github.com/Galanoris/LifetrackerApp (public). A push to `main` triggers GitHub Actions, which runs the tests and builds, then deploys to https://galanoris.github.io/LifetrackerApp/ (case-sensitive). The installed app shows "A new version is available → Reload".

## Layout

    src/lib/        types, db (Dexie), dates (ISO weeks, morning cutoff), stats (+ CSV), seed, files, demo (dev only)
    src/screens/    Today, Week, Insights, Settings, QuestionEditor
    src/components/ QuestionCard, Charts (line + heatmap), Icons, grouping
    tests/          vitest
