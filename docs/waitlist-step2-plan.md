# WAITLIST_STEP2_V1 plan

## Build record, 2026-10-26

**Built, and committed locally in both repos. Nothing is pushed or deployed, and migration 0077 is not
applied.** This was built under the founder's rulings of 2026-10-26:
1. All four questions ship together.
2. The token design in section 3 is approved.
3. `priority` is NOT NULL DEFAULT false.
4. Instrument Sans, no Inter.
5. No mock file.
6. The copy in section 4.
7. Priority is set for any answer in any group.
8. Sections 7 and 8 stay as written, for counsel's single end-of-build review. Counsel gates no step.

Where the build differs from the text below:
- **Section 2.** The migration has `priority boolean not null default false` (ruling 3). The CHECKs
  therefore compare `priority` directly, without `coalesce`.
- **Section 3b.** `setProfile` writes `priority_at = now()` rather than `coalesce(priority_at, now())`.
  Each row gets one single-use token, so `priority_at` is always NULL before that write and the two are
  the same. supabase-js cannot express the `coalesce`.
- **Section 4.**
  - The thanks state is one line in the done pill, "Thank you, you've moved up." followed by today's
    inbox or no-mail sentence.
  - After a second failed save, "Move me up" is removed and Skip stays.
- **Final CTA and early-access cards repeat a sentence.** Their existing lede reads "Early access opens
  in small groups." and the step-2 lede below it opens with the same sentence. The copy is as ruled. It
  is left for the founder to decide.
- **Section 9.** There is no `mocks/waitlist-step2.html` (ruling 5).
- **WI-4d** in `test-waitlist-inline.mjs` now leaves the hidden `.wl-step2` out of the hero text, since
  the founder's step-2 copy carries the sentence it guards against. It still guards the line under the
  hero form.
- **Backend tests WL-H1 to WL-H4** assert the new `step2` field in the signup response.

Status as originally written: **plan only.** No code, no migration, no commit, no lock. Every reference below was
read from the files on 2026-10-26: website `main` at `4986e31`, backend `biowellth-backend-supa` `main`
at `e5c6e1e`. Re-check line numbers before building.

**Read this first.** Counsel's waitlist ruling deferred the interest question, and that deferral is a
written launch condition: "Keep Part B's interest question deferred" (backend
`docs/evidence/counsel-reply-waitlist-2026-10.md:62`, reasoning at `:51-53`). The persona and need
questions here are interest questions. They are close kin of the "Hormones and cycle" option counsel
pulled. Under the founder's 2026-10-24 ruling counsel reviews everything once, at the end of the build.
That covers sequencing. It does not lift condition 4. If step 2 ships before counsel answers, record
that as the founder's call, the same way `docs/waitlist-inline-plan.md:3-8` recorded v1.4. It is not a
sign-off.

The amendment of 2026-10-26 is folded in: new header copy and buttons, a "Prefer not to say" chip,
`priority` and `priority_at`, the "Honoring priority" section and the consent question for counsel.

---

## 1. What exists today (verified)

### 1a. Inline waitlist forms, all in `index.html`

There are three instances. They share the same markup and all bind to one script. No other page has a
waitlist form. `waitlist/index.html` and `early-access/index.html` only redirect to `/#early-access`
(`early-access/index.html:8-9`, `waitlist/index.html:44-46`).

| # | Where | Markup | Container |
|---|---|---|---|
| 1 | Hero | `index.html:627-640` (`.wl-hero > .wl-block`, input `#wl-email-hero`) | **No card.** It sits directly on the orb, capped at 460px (`index.html:428`, `:435`) |
| 2 | Final CTA `#join` | `index.html:861-873` (input `#wl-email-join`) | `.final-panel.glass` (`index.html:852`, `:377`, `.glass` at `:195`) |
| 3 | Early-access page `#page-early-access` | `index.html:897-909` (input `#wl-email-ea`) | `.final-panel.glass.ea-inline` (`index.html:895`) |

Instances 2 and 3 carry counsel's signup notice under the form (`index.html:872`, `:908`). The hero
does not (`index.html:437-443`).

**CSS.** WAITLIST_INLINE_V1 is at `index.html:384-447`. Below 400px of container width a container
query stacks the pill (`:418-423`).

**Submit handler.** `index.html:1563-1667`
- `ENDPOINT` is `…/functions/v1/waitlist-signup` (`:1571`). `COPY` is at `:1572-1581`.
- `readTags()` reads the four UTMs and the referrer origin (`:1585-1599`).
- `bind(block)` is at `:1601-1661`. Client validation is at `:1628-1633`. It POSTs JSON with a 15s
  abort (`:1634-1656`).
- On a 200 it calls `setState("done")`, or `"done-nomail"` when `j.notice === "listed"` (`:1650`).
  A 429 shows `limited`, a 400 shows `invalid` and anything else shows `failed`.

**What it renders on success.** `setState` (`:1609-1621`) hides the `<form>`, fills `.wl-done-text`
and focuses `.wl-done`, a sage pill with a tick.
- If the email sent, it reads "You're on the list. Check your inbox." (`:1578`).
- If the row was saved but the email did not send, it reads "You're on the list. We'll email you when
  early access opens." (`:1580`).
- The notice paragraph stays visible under it.

### 1b. Supabase `public.waitlist`

Backend `migrations/0076_waitlist.sql:39-58`.

| Column | Type and constraint |
|---|---|
| `id` | uuid pk, `gen_random_uuid()` |
| `email` | text not null, `= lower(email)`, 3..254, **unique** (`waitlist_email_key`) |
| `signup_source` | text not null, default and CHECK `'website_inline'` only |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` | text not null default `''`, ≤64 |
| `referrer` | text not null default `''`, ≤200 (origin only) |
| `created_at` | timestamptz not null default now(), indexed |
| `unsubscribe_token` | uuid not null default `gen_random_uuid()`, **unique** |
| `welcome_sent_at` | timestamptz |
| `region_tag` | text, CHECK in 11 city codes, NULL means not answered |
| `tagged_at` | timestamptz |

**RLS.** RLS is on and there are no policies (`:70-71`). Everything is revoked from anon,
authenticated, service_role and public. service_role gets select, insert, update and delete back
(`:73-76`). Only the edge function touches the table.

**Retention.** `waitlist_retention_run()` runs nightly. It deletes rows older than 12 months and rows
whose email matches `auth.users` (`:101-111`, cron at `:119`). Any new column is deleted with its row,
so retention needs no change.

**Insert path.** Inserts go through the edge function. The browser never writes to the table directly.
- `supabase/config.toml:145-154` sets `verify_jwt = false` on purpose.
- `index.ts:39-45` upserts `onConflict: "email", ignoreDuplicates: true` and selects
  `id, unsubscribe_token`.

**What comes back to the client: nothing identifying.**
- The handler returns only `{ok:true, notice:"inbox"|"listed"}` (`handler.ts:164-179`).
- A duplicate gets the same `notice:"inbox"` on purpose, so the form cannot reveal who is listed
  (`:165-169`). The honeypot gets the same (`:145-149`).
- **The client never receives a row id or a token.** The unsubscribe token only reaches the person
  inside the welcome email (`welcome-email.ts`).

### 1c. Can an existing endpoint update a row by token? Yes, partly.

- `POST /functions/v1/waitlist-signup/tag` takes `{t, city}`. It matches on `unsubscribe_token` and
  writes `region_tag` and `tagged_at` (`handler.ts:134-142`, `index.ts:50-56`).
- It is rate limited by `limited()` (`handler.ts:81-98`).
- It answers `{ok, saved}`. Its client is `waitlist-tag/index.html:51-89`, which the welcome email's
  city links open.

**Reuse decision.** Reuse that function, its route table, `limited()`, `isUuid`, the CORS and the
`Deps` test harness. **Do not reuse the `/tag` credential.**
- The unsubscribe token can delete the row (`handler.ts:109-126`), and it lives for 12 months.
- To give it to the page, the signup response would have to carry it. That works for a new row. For a
  duplicate it would hand delete rights over someone else's row to anyone who types their email. And
  if duplicates got no token, the response would show who is already listed.

So step 2 is a sibling route, `POST /profile`, in the same function. Its credential is a short-lived,
single-use token (section 3).

### 1d. Privacy policy today (`privacy.html`, v1.4, effective October 24, 2026, `:151`)

- **Collection** (`:158`). "Waitlist information if you join our waitlist on our website, meaning your
  email address, the campaign tags in the link that brought you to our site, the website that referred
  you, and, only if you choose to tell us, the city you live in."
- **Purpose** (`:160`). "If you join our waitlist, we use your email address to confirm your signup
  and to invite you to early access, the campaign tags and referring website to understand which links
  and sites bring people to the waitlist, and your city, if you give it, to plan where early access
  opens first. **We do not use waitlist information for any other purpose.**"
- **Resend** (`:184`). Waitlist emails are the welcome email and the early-access invitation.
- **Storage** (`:204`). Supabase, Mumbai.
- **Removal** (`:206`). Removal is by the email link or by request, and it deletes the waitlist
  information.
- **Retention** (`:208`). 12 months, or earlier on invite or account creation.

Step 2 adds four answers, a founder chat and priority ordering. **None of them is covered by `:158`
or `:160`.** That needs v1.5 (section 7).

---

## 2. Schema change: backend `migrations/0077_waitlist_step2.sql`

```sql
-- WAITLIST_STEP2_V1. Optional step-2 answers, priority, and the short-lived token that authorises them.
begin;
alter table public.waitlist
  add column persona_tag  text check (persona_tag in
      ('results_normal_feel_off','stay_ahead','curious','prefer_not_say')),
  add column need_tag     text check (need_tag in
      ('read_existing','home_panel_tracked','fullest_specialist','not_sure')),
  add column heard_from   text check (heard_from in
      ('instagram','friend_family','search','podcast_article','linkedin','other')),
  add column chat_opt_in  boolean,                      -- NULL never answered, true Yes, false No
  add column profiled_at  timestamptz,                  -- when step 2 was submitted
  add column priority     boolean default false,        -- per the amendment (see note)
  add column priority_at  timestamptz,
  add column profile_token            uuid,
  add column profile_token_expires_at timestamptz;
-- Defaults set AFTER the add, so existing rows get no token they were never sent.
alter table public.waitlist alter column profile_token set default gen_random_uuid(),
                            alter column profile_token_expires_at set default now() + interval '2 hours';
create unique index waitlist_profile_token_key on public.waitlist (profile_token);
-- Priority needs at least one answer, in ANY group. Persona alone is not special.
alter table public.waitlist add constraint waitlist_priority_needs_an_answer check (
  coalesce(priority, false) = false
  or persona_tag is not null or need_tag is not null or heard_from is not null or chat_opt_in is not null);
alter table public.waitlist add constraint waitlist_priority_at_pairs check (
  (coalesce(priority, false)) = (priority_at is not null));
commit;
```

- **Codes, not labels.** Labels live in `validate.ts`, next to `CITIES`, and a test pins them to the
  CHECKs, as WL-E3 does for cities.
- **No free text anywhere.** "Other" is a code, with no box to type in. Typed text is how health
  detail gets in.
- **`priority` nullable versus not null.** The amendment says nullable with default false. I recommend
  `not null default false`, so the wave query never meets a third state. The CHECKs above treat NULL as
  false either way. It is a one-word change and the founder's call.
- **Grants.** No change. The service_role grant from 0076 covers the new columns, and RLS stays with no
  policies.
- **Does `heard_from` duplicate the UTMs? No. Keep both.**
  - `utm_source` and the referrer are **attribution**: what link or site carried the visit. They are
    empty for direct visits and for most word of mouth.
  - `heard_from` is **self-report**: where the person first heard about BioWellth.
  - Someone who heard on a podcast and then searched shows `utm_source=''`, `referrer=google`,
    `heard_from=podcast_article`. Only the self-report captures that.
  - They overlap only for Instagram and LinkedIn links. Analysis treats the UTMs as the source of
    truth for paid and campaign links and `heard_from` for everything else.
  - It is a single column, so it does not replace or rename anything.
- **Rollback.** Drop the two constraints, the index and the nine columns.

---

## 3. Update path, secured by the signup token

### 3a. Signup response (`handler.ts:144-179`), additive

Every 200 from signup gains `step2`, a uuid.
- **New row:** the row's real `profile_token`. `insertSignup` selects it alongside `id` and
  `unsubscribe_token` (`index.ts:42`). This applies both when the email sent and when it failed.
- **Duplicate and honeypot:** `crypto.randomUUID()`, a decoy that matches no row.

The response is identical in shape and type in every case, so duplicates stay indistinguishable. The
`notice` field is unchanged. An old client ignores `step2`, so the backend can deploy first.

### 3b. `POST /functions/v1/waitlist-signup/profile`

Add `"profile"` to `route()` (`handler.ts:58-66`).
- **Body.** `{p, persona?, need?, heard?, chat?}`, inside the existing 2048-byte cap (`MAX_BODY`).
- **Rate limit.** It goes through the same `limited()`, sharing the 10-per-hour budget with signup and
  tag. One person needs at most a signup, one step 2 and a couple of city taps.
- **400 when:**
  - `p` is not a uuid;
  - any present field is outside its allowlist (`chat` must be a boolean);
  - all four fields are absent.
- **The new dependency, `setProfile(p, fields)`, runs one update:**
  ```
  update waitlist set <only the fields present>,
         profiled_at = now(), priority = true, priority_at = coalesce(priority_at, now()),
         profile_token = null, profile_token_expires_at = null
   where profile_token = $p and profile_token_expires_at > now()
  returning id
  ```
  Fields that are absent are never written, so they stay NULL.
- **Priority is set by the server** whenever the body passed validation. That means at least one answer
  in any group. The client never sends a priority flag. Nothing in the code path reads `persona` to
  decide it.
- **Response.** Always `{ok:true}` on valid input, whether or not a row matched. A decoy or expired
  token looks the same to the page. The log records `profile_saved` or `profile_no_row`, never the
  token.
- **Single use, two hours.** After one save the token is null, so a replay does nothing. A page left
  open overnight saves nothing and still shows thanks.

### 3c. Client handling of the token

- It is held in a closure variable inside `bind()` only. It never goes into a URL, `localStorage`,
  `sessionStorage`, the DOM, `console` or an error message.
- The Sentry `beforeSend` (`index.html:1766`, `:1862`) builds events from scratch and drops requests.
  The build adds a test asserting that no event or breadcrumb contains a uuid. The existing uuid-drop
  rule at `:1724` already covers this.

### 3d. Known limitation

Someone who signs up again with an address that is already listed gets step 2, but their answers go
nowhere because the token is a decoy. That is the price of not revealing who is listed. It is accepted.

---

## 4. UI states

`bind()` gains a third panel, `.wl-step2`, in each `.wl-block`. It is cloned from one
`<template id="wl-step2-tpl">`, so the three instances cannot drift. Per-instance ids are suffixed
(`-hero`, `-join`, `-ea`).

```
idle ──submit──▶ sending ──200 + step2──▶ STEP2 ──Move me up──▶ saving ──▶ THANKS
                       │                    │                       └─fail─▶ STEP2 + error (retry / skip)
                       │                    └──Skip for now──▶ SKIPPED
                       ├─200, no step2 (old backend)──▶ done   (today's behaviour, unchanged)
                       └─400 / 429 / 5xx──▶ today's messages, unchanged
```

**Step 1 is untouched.** Same markup, same copy, same validation, same notice line.

**STEP2.** The form hides, `.wl-done` stays hidden and `.wl-step2` shows in the same place.
- **Header.**
  - Fraunces 500, 20px, ink: "You're on the list."
  - Instrument Sans, 15px, ink-muted: "Early access opens in small groups. Answer a few quick taps and
    we'll move you up."
- **Four fieldsets.** Each has a `<legend>` and native radios styled as chips.
  1. *Which sounds most like you?* "My results say normal, but something feels off" · "I feel fine and
     want to stay ahead" · "Just curious what my body is doing" · "Prefer not to say"
  2. *What would help most right now?* "Read the tests I already have" · "An at-home panel, tracked over
     time" · "The fullest picture, with a specialist" · "Not sure yet"
  3. *How did you hear about us?* Instagram · Friend or family · Search · Podcast or article ·
     LinkedIn · Other
  4. *Open to a 15-minute chat with the founder?* Yes · No
- **Primary ink pill, "Move me up".** It stays `aria-disabled="true"` until at least one chip in any
  group is selected. Tapping it while disabled shows "Pick any one answer to move up." in `.wl-msg`.
  "Prefer not to say" and "Not sure yet" count as answers.
- **Secondary text link, "Skip for now".**
- **Clearing.** Tapping a selected chip clears it, so "optional" stays true after a mis-tap. Arrow keys
  move within a group, as native radios do.
- **Focus.** Focus moves to the step-2 heading (`tabindex="-1"`), replacing `done.focus()` at `:1620`.
  If the card's top is off screen, `scrollIntoView({block:"start"})` runs, with no smooth scroll under
  `prefers-reduced-motion`.
- **Notice line.** It stays where it is on instances 2 and 3.

**saving.** "Move me up" reads "Saving…" and is disabled. The POST to `/profile` has a 15s abort.

**THANKS.** `.wl-step2` hides and `.wl-done` shows.
- First line: "Thank you, you've moved up."
- Then today's line: `COPY.done` or `COPY.doneNoMail`, chosen from step 1's `notice`. The "check your
  inbox" truth is preserved.

**SKIPPED.** `.wl-step2` hides and `.wl-done` shows exactly today's text. Nothing is sent.

**Step-2 failure.** A 429, a 5xx or a timeout keeps the chips.
- `.wl-msg` reads: "We couldn't save your answers. You're still on the list."
- "Move me up" re-enables for one retry. Skip still works.
- A 400 cannot happen from the UI. If it does, the page goes to SKIPPED.

House copy rules apply: no colons and no em dashes in UI strings.

---

## 5. Design (BioWellth tokens as they exist in `index.html`)

**The brief's names map onto the live tokens like this.** The site has no `cocoa`, `paper` or Inter
token.
- **Cocoa** is `--ink #47372B` (`:146`).
- **Paper** is the existing `--glass rgba(251,250,249,.8)` card (`.glass`, `:195`). It is the same
  surface as `.final-panel` and the `waitlist-tag` card.
- **Inter is not loaded anywhere.** CLAUDE.md fixes UI and body text as Instrument Sans (`--sans`,
  `:172`), with Fraunces for headings. **Recommendation: labels in Instrument Sans 500, not Inter.**
  Adding Inter would mean a new font request and a third family, against the brand system. If Inter is
  truly wanted, that is a brand change and the founder's call.

**Card.**
- Instances 2 and 3: the step-2 content sits inside the existing `.final-panel.glass`.
- Hero: the hero has no card today, so `.wl-step2` brings its own paper card: `.glass`, radius 24px,
  max-width 460px, the hero's existing cap. The chip labels sit on glass, not on the orb. That is the
  same fix `index.html:436-444` used for the hero error message, measured at 5.04:1 or better there.
  Re-measure at build.

**Legends.** Instrument Sans 500, 14px, `--ink`, 8px gap to the chips.

**Chips** (new class `.wl-chip`; do not reuse `.chips li`, which is coral-soft at `:265`).
- **Unselected.** `background:rgba(255,255,255,.6)`, `1px solid rgba(71,55,43,.18)`, text `--ink`,
  500 weight, 14.5px, radius 100px, min-height 44px, padding 10px 16px.
- **Selected.** `background:var(--ink)`, `color:var(--cream)`, border `--ink`, and a small cream tick
  before the label. The tick means the state is not carried by colour alone.
- **Hover.** Border goes to `rgba(71,55,43,.35)`.
- **Focus-visible.** `2px solid var(--olive)`, offset 2px, matching `.wl-done:focus-visible`.
- **No coral anywhere on chips** in any state. Coral stays only on the error text
  (`--coral-deep-text`, `.wl-msg`). Add an assertion to the build tests that no computed chip
  background, border or colour is in the coral family.

**Buttons.**
- "Move me up" uses the existing `.btn.btn-ink`.
- "Skip for now" is a text link styled like `.final-privacy a`, but in `--ink-muted`, not coral, with
  a 44px tap area.

### Mobile (375 to 400px container; reuse the `@container (max-width:400px)` at `:418`)

- Card padding goes to 20px 18px.
- Persona and need chips go **full width, one per line**, left-aligned, with wrapping allowed. Their
  labels are up to 47 characters and would otherwise clip or wrap awkwardly. The persona group alone
  is about 4 × 52px.
- `heard_from` chips wrap inline, about 3 per row. Yes and No sit side by side at 50% each.
- "Move me up" goes full width. "Skip for now" is centred below it.
- **Estimated height at 375px is about 640px.** That is why the scroll-to-top on entry matters,
  especially in the hero.
- Above 400px, persona and need chips wrap inline too.
- Verify at a true 375px and at 1280px in a mock (`mocks/waitlist-step2.html`) before it goes into
  `index.html`, as WAITLIST_INLINE_V1 did.

---

## 6. Honoring priority

**How wave one uses it.** Invitations are manual today (backend `docs/waitlist-delete-request.md`,
section B). Wave one selects in the SQL editor:

```sql
select id, email, created_at, priority, priority_at, region_tag
  from public.waitlist
 order by coalesce(priority, false) desc,   -- step-2 answerers first
          priority_at asc nulls last,       -- earliest answerer first
          created_at  asc                   -- then everyone else, first come first served
 limit $wave_size;
```

- **The order uses priority, priority_at and created_at only.** It never filters or orders by
  `persona_tag`, `need_tag`, `heard_from` or `chat_opt_in`. Doing so would make priority depend on the
  answer, which the amendment forbids.
- If wave one is limited by city, `region_tag` may filter. That is the purpose already disclosed for
  city.
- **Write this query into runbook section B** as the only sanctioned invite order. Each invite still
  deletes the row afterwards, per counsel.
- **Typeform signups** are not in this table and have no priority. How they interleave with website
  rows is the founder's call. Record the call in the runbook.

**Confirmed: nothing else reads these columns.** A grep of both repos on 2026-10-26 finds `waitlist` in
code only in these places:
- the function: `handler.ts`, `index.ts`, `validate.ts`, `welcome-email.ts` and the test;
- migration 0076;
- `config.toml`.

What they read:
- The function selects only `id, unsubscribe_token` on insert, and `id` on tag and delete.
- The retention job only deletes.
- There is no export, no view, no analytics sync and no other function.

After the build:
- `priority` and `priority_at` are written only by `setProfile`.
- They are read only by the invite query above.

Add a backend test that fails if `priority` appears in any other function source.

---

## 7. Privacy policy v1.5 (draft for counsel, do not publish ahead of review)

- **`:158`.** Add after "the city you live in": "and, only if you choose to answer, which description
  sounds most like you, what would help you most, how you heard about us, and whether you are open to a
  short call with our founder."
- **`:160`.** Add: "Your optional answers help us plan early access, and if you answer any of them we
  invite you sooner. If you say yes to a call, we may email you once to arrange it."
- **Persona.** If counsel classifies "My results say normal, but something feels off" as consumer
  health data, the MHMDA consumer-health-data notice and a separate consent apply. That is counsel's
  call (section 8).
- **`:206` and `:208`.** No change. The new fields are waitlist information and are deleted with the
  row.

---

## 8. Counsel: items for the single end-of-build review

**New fields** (all optional, all deleted with the waitlist row, no free text):

| Field | Values | Purpose |
|---|---|---|
| `persona_tag` | results normal but something feels off · fine and want to stay ahead · just curious · prefer not to say | plan early-access groups |
| `need_tag` | read tests I already have · at-home panel over time · fullest picture with a specialist · not sure yet | plan what to offer first |
| `heard_from` | Instagram · friend or family · search · podcast or article · LinkedIn · other | self-reported source, alongside the UTMs |
| `chat_opt_in` | yes · no | founder may email once to arrange a 15-minute call |
| `priority`, `priority_at` | set on any step-2 answer | invite order |

**Questions.**

1. **Condition 4.** Counsel deferred the interest question (reply `:51-53`, `:62`). Do the persona and
   need questions fall under that deferral? If so, what notice and consent design lets them ship?
2. **Closest to health data.** "My results say normal, but something feels off" is the option closest
   to health information. It implies the person has had tests and has symptoms or concerns. Is it
   consumer health data under MHMDA, or special-category data under GDPR and UK GDPR? Is it sensitive
   personal data under DPDP practice?
   - If yes, should it be dropped, reworded (for example "I want a second look at my results"), or
     kept with separate consent?
   - "Read the tests I already have" is the next closest, because it implies tests exist.
3. **Priority and consent.** "Does offering priority access in exchange for optional profile answers,
   including a persona option close to health information, affect freely given consent under MHMDA and
   DPDP? Priority is granted for any answer, including 'Prefer not to say'."
4. **Founder chat.** Is a yes to the 15-minute chat within "early access" purposes? Or is it the kind
   of expansion counsel asked to see again (reply, Part A item 3)?
5. **v1.5 wording.** Does the section 7 wording cover the new fields and purposes?

---

## 9. Build order, tokens and tests (for when it is greenlit)

1. **Backend, under the backend lock.**
   - Write migration 0077 and its read-back.
   - Update `validate.ts` (the three allowlists, pinned to the CHECKs), `handler.ts` (`/profile`, the
     `step2` field) and `index.ts` (`setProfile`, the `profile_token` select).
   - Add tests:
     - WL-P1: priority is set for each single-group answer, including `prefer_not_say` alone and
       `heard` alone.
     - WL-P2: an empty body gives 400 and no priority.
     - WL-P3: a decoy or expired token gives the same `{ok:true}` and no write.
     - WL-P4: a duplicate signup's `step2` is a uuid that matches no row.
     - WL-P5: single use.
     - WL-P6: no other source reads `priority`.
   - Deploy. Old clients are unaffected.
2. **Website, under the website lock (a push here is a deploy).**
   - Build `mocks/waitlist-step2.html` first.
   - Then the template, CSS and `bind()` changes in `index.html`, all tagged `WAITLIST_STEP2_V1`.
   - Extend `scripts/test-waitlist-inline.mjs` with the step2, thanks, skipped, failure, old-backend
     and token-never-in-URL-or-storage cases at 1440 and 390.
   - Keep `test-leftovers-palette.mjs` green.
3. **Privacy v1.5** after counsel, or as the founder decides, recorded as such.
4. **Runbook section B** gets the invite query.

## Not in scope

The welcome email, the city tag page, unsubscribe, retention jobs, Typeform records, any analytics or
tracking addition.
