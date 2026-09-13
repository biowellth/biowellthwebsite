# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The BioWellth front end: hand-written static HTML/CSS/JS with **no build step, no package manager, no test suite, and no lint config**. Every page is a single self-contained file with its CSS in a `<style>` block and its JS in a `<script>` block. The only external runtime dependency is `@supabase/supabase-js@2` from jsDelivr (plus Google Fonts and a Typeform embed on the marketing page).

Deployed to GitHub Pages from `main` (`CNAME` → biowellth.ai). Pushing to `main` is the deploy — there is no staging environment.

The backend lives in a **separate repo** (see Sibling repos below); it is not checked out inside this one. Comments here reference paths inside it (e.g. `supabase/functions/process-report-worker/biomarker-library-v2.1.1.json`) and migration numbers (`0022`, `0023` — in `migrations/` at that repo's root, not under `supabase/`).

## Sibling repos

**Backend: `~/Desktop/biowellth-backend-supa`** — Supabase edge functions, SQL migrations, and the master context doc in `docs/`. Its `CLAUDE.md` holds the standing operational rules — read it before any backend write, and before any task here that touches the `results.payload` contract, an edge function, or biomarker ranges.

**The biomarker library's source of truth is in that repo**, at `supabase/functions/process-report-worker/biomarker-library-v2.1.1.json`. Nothing in this repo is an authority on a marker range: `ranges-slim.json` here is a generated projection of it (see Commands below), and the backend's own `process-report/` copy is stale and drifted — never source a range from either. When you need a real range value, to answer a question or to change one, read the worker copy and nothing else.

## Commands

There are none to build or test. To preview locally:

```
python3 -m http.server 8000        # then open http://localhost:8000/index.html
```

Caveat: links across the site use **clean, extension-less paths** (`/dashboard`, `/privacy`, `/terms`, `/early-access`). GitHub Pages resolves those to the `.html` files; `python3 -m http.server` does not. Locally, navigate with the `.html` suffix.

Regenerating the client-side marker ranges (only when the backend library version bumps):

```
python3 scripts/build-ranges-slim.py \
  ~/Desktop/biowellth-backend-supa/supabase/functions/process-report-worker/biomarker-library-v2.1.1.json \
  ranges-slim.json
```

Source the **`process-report-worker`** copy of the library — it is authoritative. The `process-report` copy is stale and drifted. After regenerating, **bump `RANGES_BUILD`** (a date-int string near the ranges loader in `dashboard.html`) — `ranges-slim.json` is fetched with `cache: 'force-cache'` and the URL query is the only cache key that changes, so a rebuild without a bump ships nothing to returning browsers. Commit the script and the JSON together.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Marketing site. A client-routed pseudo-SPA: `.page` divs toggled by one `route()` function. |
| `login.html` | Supabase email/password signup + sign-in. Redirects to `/dashboard`. |
| `dashboard.html` | The product. ~7.8k lines; everything else is small by comparison. |
| `privacy.html`, `terms.html` | Legal pages. `privacy.html` carries the "How we use AI" disclosure. |
| `early-access/index.html` | 10-line redirect stub for link-in-bio; preserves the query string into `/#early-access`. |
| `scripts/build-ranges-slim.py` + `ranges-slim.json` | See above. `ranges-slim.json` is generated — never hand-edit it. |
| `mocks/` | Untracked design mocks (see below). Not in `.gitignore` — just never committed. |
| `llms.txt`, `robots.txt`, `sitemap.xml`, `site.webmanifest` | Crawler/PWA metadata. Keep `llms.txt` in sync with product claims. |

## `dashboard.html` architecture

One file, one global scope. Structure: `<style>` (lines ~12–1143) → markup for every view → the Supabase CDN script → one ~6k-line `<script>`.

**View state machine.** `showView(name)` toggles `#view-upload | processing | reveal | dashboard | interim` and nothing else. Four further views (`#view-gaps`, `#view-systems`, `#view-trends`, `#view-markers`) are overlays with their own `open*View()`/`close*View()` pairs, not part of `showView`.

**Backend surface** (Supabase project `clacgutnrktdwhglvyua`; the URL and publishable anon key are duplicated verbatim in `login.html` and `dashboard.html`):

- Tables read/written directly: `profiles`, `reports`, `results`, `action_pool`, `action_completions`
- Storage bucket: `reports` (PDF upload, then `createSignedUrl` for read-back)
- Edge functions invoked from the client: `process-report` (upload / `mode:"retry"` / submit-mode), `enqueue-rescore`, `consent-accept`, `affirm-age`, `delete-account`. The backend has others that the client never calls directly.
- RPCs: `commit_between_calls`, `set_confounder`, `set_report_confounder`

**The payload contract.** `results.payload` is a v1.3 jsonb blob written by `process-report-worker`; its shape is documented in a `/* CONTRACT: */` comment right below the Supabase client init. Everything the dashboard renders — vitality composite, systems, priorities, quietly_working, foundations — comes from there. Payloads are loaded **one panel at a time**, never bulk-loaded to fill the panel switcher.

**Cross-render state** lives on `window.__*` globals (`__rdPayload` is the current panel's payload, `__allReports`, `__bc`, `__clarifyByReport`, `__drawReportId`, …). This is deliberate, not accidental — new state follows the same pattern rather than introducing a store.

**The upload → reveal pipeline** is the most intricate part and is heavily commented with measured timings. Key invariants encoded there:

- Consent is recorded (`consent-accept`) *before* any storage upload or DB write.
- The processing screen's interim states are chosen by **elapsed time**: `PC_IN3` under `PC_LONG_MS` (9 min), `PC_IN4` past it. The threshold is tuned against measured end-to-end runs; the reasoning is in the comment block above `PC_LONG_MS`.
- Three distinct failure states, and which one renders is a correctness question, not a cosmetic one: `FAIL-2` (retry available), `FAIL-5` (the single retry is spent — renders **no** retry control), `FAIL-6` (unretryable, no transcription exists — retry can never help). Never show a control the backend will refuse; never claim a retry happened that did not.
- Polling survives backgrounded tabs (`STALE_TAB_POLL_V1`: tick immediately on focus, re-arm, tolerate one transient fetch failure) and a late-arriving `action_pool` write (`DAILY_CARD_LATE_POOL_V1`: a *bounded* secondary poll).

## `index.html` routing

`route()` is the single router, bound to both `popstate` and `hashchange`, and is idempotent — both fire on a hash traversal. Pages are clean paths (`/`, `/early-access`); in-page sections stay `#fragments` and live on home. Two rules the existing code is careful about, worth preserving in any edit:

1. **Always carry `location.search`.** Campaign params (`?src=ig`) must survive a page switch. Compose and compare URLs as `path + search + hash`, in that order.
2. **Guard every push/replace by comparing the whole composed URL**, so a repeat click or a cold load never stacks a duplicate history entry (which makes Back look dead).

## Conventions

**Commit messages** name a versioned change token, then what it did: `PROCESSING_COPY_V2: raise the IN-3 -> IN-4 threshold 6 -> 9 minutes`. The same token appears as a code comment at every site the change touched, which is how a feature's scattered edits are found later. Reuse the existing token when extending a feature; mint a new `_V1` for a new one.

**Comments explain *why*, and supersede rather than delete.** When a constant or threshold changes, the outdated justification is corrected in place with a note that it was corrected — so the change stays legible. Match this; do not strip the reasoning out of a comment block to make it shorter.

**User-facing copy is authored, not generated.** Strings marked `byte-exact from the artifact`, `SIGNED`, `verbatim`, or `never model-authored` (the `PC_*` failure/interim constants, marker explainers, system intros, reveal-deck copy) are ratified elsewhere and referenced to signed docs in the backend repo. **Do not reword, "improve", or paraphrase them.** Changing one is a product decision, not an edit.

**Copy tone rules**, applied to anything new that a user reads: warm, plain, hedged — **no colons, no em dashes**. `esc()` strips em dashes on the way in because the model occasionally emits them. The one exception is model-authored payload prose, which renders verbatim.

**Honesty over polish** is the recurring standard in this codebase, and several commits exist purely to fix a screen that overstated what happened. When a state is uncertain, say so; when a control will not work, do not render it.

**One writing session per repo (rule 18).** Before any write, check for `docs/.session-lock`. A
fresh lock you do not own means go read-only. Otherwise create it (session id, UTC stamp, scope,
repos) and commit it with your first write; remove it at seal. Read-only parallel sessions are
fine; the lock governs writes.

**The lock is COMMITTED, not just written.** A lock that exists only in a working tree protects
nobody, because the thing it protects against is another session operating on that same working
tree. Both incidents below were invisible to anyone reading the file list.

**CLAUDE.md, `docs/` and `scripts/` are absent from biowellth.ai because of ONE
LINE, and nothing else.** `_config.yml` carries an `exclude:` list and Jekyll
honours it. Lose the file, mistype an entry, or move Pages to an Actions build,
and all three are publicly readable again with no error raised anywhere. They
were readable until 2026-09-12 15:39: `/CLAUDE.md` returned 200 on the live
origin, and at that moment this file still carried a section naming unfixed
defects in `login.html`.

**The check is a LIVE FETCH, `scripts/check-live-exclusions.mjs`, and reading
the exclude list is not a substitute.** Reading it proves the list says the right
thing; it cannot prove Pages honoured it or that the build ran. During the
exposure window the repo was correct and the served artifact was not. Run the
script after any push and after any change to `_config.yml`. It derives its path
list from `git ls-files`, so new internal files are covered automatically, and it
aborts rather than reporting green if every control fails, because an offline
machine answers every exposure assertion with a reassuring failure to connect.

Two of the five exclude entries, `mocks/` and `VERIFY-be37803.md`, have no
tracked files and are safe by construction rather than by that config line. The
surface that genuinely depends on it is `CLAUDE.md`, two files under `docs/` and
sixteen under `scripts/`.

**This lock matters more here than in the backend repos, because a push here IS a deploy.**
`main` is served by GitHub Pages at biowellth.ai and new bytes are live in roughly 61 seconds.
There is no staging step and no review gate between a push and a stranger reading the page.

Earned 2026-09-12, twice in one afternoon. First a commit landed on `main` beside an in-flight
session's work and rode along in its push set. Then, while that session was mid-command, another
one checked out a different branch in the same working tree, cherry-picked onto it and pushed.
Every file the first session had touched reverted on disk underneath it, its test assertions
read as deleted, and only the reflog showed why. Nothing was lost, and that was luck rather than
design.

**Design tokens** (`--cream`, `--teal`, `--brown` families everywhere, `--coral` in all but `terms.html`, plus `--amber` in `dashboard.html`) and the font stack (Plus Jakarta Sans / Instrument Sans / JetBrains Mono) are re-declared in each file's `:root`. There is no shared stylesheet — keep the values identical when adding a page.

**`mocks/`** holds standalone single-file mocks named after the change token (`mocks/quota-429.html`, `mocks/processing-copy.html`). Each copies the live classes out of `dashboard.html` and renders every state of a screen side by side for review before the change is wired into the app. The directory is untracked working material — build a mock here first for anything that changes what a user sees in a hard-to-reach state (a failure, a quota block, a long-running job).
## Closed: the three login.html defects, FIXED 2026-09-07

Found live 2026-09-05 while provisioning the under-18 battery fixture
(`515bd491`). All three were in `login.html` and all three were hit in a single
signup, which is why they were the fix-now tier rather than the backlog: they
compounded, and a first real tester met every one of them inside a minute.

**All three are fixed. Re-verified against the tree by direct read 2026-09-13
before this section was rewritten, rather than taken from the commit messages.**
The history is kept rather than deleted, because the shape of the failure is the
useful part and a reader who lands on this heading needs to know the work is
done rather than wonder.

**THIS SECTION SAID "FIX NOW" FOR SIX DAYS AFTER THE WORK LANDED**, which is its
own defect. A stale list of open defects costs a future session an hour
re-fixing closed work, or gets trusted so a real check is skipped. It also sat
in the file that was publicly readable until 2026-09-12 15:39, so for five days
it advertised unfixed authentication weaknesses that no longer existed.

1. **Post-signup returned to the login form with no mention of email.** It said
   "Account created. You can now sign in." and called `swapTo("login")`, which
   was false while `mailer_autoconfirm` is off: signing in is exactly what does
   not work until the address is confirmed. **FIXED in `e3e1ba0`, 2026-09-07,
   "login: check-your-email interstitial after signup".** There is a dedicated
   check-your-email view at `login.html:113` and the old string is gone.

2. **Sign-in with an unconfirmed email reported the wrong cause.** Every error
   collapsed to "Email or password is incorrect", so a correct password on an
   unconfirmed account sent someone to reset a password that was never wrong.
   **FIXED in `f180f7f`, 2026-09-07, "login: unconfirmed-email sign-in
   message".** `login.html:286` branches on the GoTrue "Email not confirmed"
   error before the generic message at `:287`.

3. **Sign in and Create account shared one URL with no indicator**, and signup
   was the default. **FIXED in `3c08efa` and `2c4f1ce`, both 2026-09-07 — NOT in
   the two commits above.** `3c08efa` makes sign in the default and opens the
   create view only on `?mode=signup`; `2c4f1ce` makes the URL reflect the pane.
   `?mode=login` is still honoured so links already sitting in inboxes keep
   working, and `scripts/test-login-modes.mjs` covers it.

**Item 3 is why "all three were fixed in e3e1ba0 and f180f7f" is not quite
right**, and it is recorded because the same shortcut would send the next reader
looking in the wrong two commits. Four commits closed three defects.
