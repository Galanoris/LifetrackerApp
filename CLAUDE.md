# CLAUDE.md – Operating Rules

These rules apply to every task in this project. Follow them in order of priority.

## Rules

1. **Never delete any data unless explicitly prompted.** This includes files, folders, fonts, images, form entries, analytics settings, git history and any content inside files. If something seems obsolete, ask first – don't remove it. Overwriting a file's content counts as deleting the old content.
2. **Patch, don't rewrite.** When changing an existing file, make targeted edits to the relevant lines. Never re-write an entire file from scratch.
3. **The spec is the source of truth.** Build against `event-landing-page-spec.md`. If a change contradicts the spec, point it out and ask before proceeding.
4. **Never send personal data to analytics.** Tracking calls may only contain the props defined in the spec (`location`, `team_size`, `occasion`, `budget_given`, `newsletter_opt_in`). Never name, company, email or free text.
5. **No third-party requests at runtime.** No Google Fonts CDN, no external icon libraries, no cookies. The only allowed third-party script is the analytics tool (Plausible or Umami). Fonts stay self-hosted in `/fonts`.
6. **No fake social proof.** No testimonials, client logos, star ratings, invented numbers or placeholder versions of them.
7. **Site copy is German and informal.** Address the team with "ihr/euch", a single person with "du". Never "Sie". Short sentences, no buzzwords.
8. **Keep it simple.** Static HTML/CSS/JS only: no frameworks, no build step, no new dependencies without asking. The one server-side exception is `send.php` (netcup mail handler). Test tooling lives in `.venv` and never ships to the server.
9. **Keep placeholders visible.** `[STADT/REGION]`, `[DOMAIN]`, `[EMPFAENGER-EMAIL]` and the TODO comments stay until real values are provided by the user.
10. **Don't publish, deploy, commit or push without asking.** Anything outward-facing needs explicit approval.
11. **Report honestly.** Say what was changed, what was verified and what was not.

## Project layout

```
index.html        – landing page
impressum.html    – legal placeholder
datenschutz.html  – privacy placeholder
styles.css        – all styles (design tokens as CSS variables at the top)
script.js         – tracking wrapper, CTA/form events, form handling
send.php          – form mail handler for netcup (validation, honeypot, mail())
fonts/            – self-hosted Fraunces + Inter (variable woff2, SIL OFL)
images/           – images (hero photo goes here later)
tests/            – Playwright (Python) tests: CTAs, form flow, analytics privacy, send.php
```

Upload to netcup: everything except `tests/`, `.venv/`, `pytest.ini`, `requirements-dev.txt`, `CLAUDE.md` and the spec.

## Local preview

```sh
python3 -m http.server 8000
# open http://localhost:8000 – tracking events show in the browser console as [track]
# Note: this server can't run PHP, so a form submit shows the error message locally.
```

## Tests

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/playwright install chromium webkit
.venv/bin/pytest                    # all profiles: desktop, mobile-android, mobile-iphone
.venv/bin/pytest -k mobile-iphone   # one profile
```

Run the tests after every change to `index.html`, `script.js` or `send.php`. The `send.php` tests are skipped unless a `php` binary is on PATH (or `PHP_BIN` is set).
