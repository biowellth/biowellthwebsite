# WAITLIST_INLINE_V1 plan

Status: **PLAN ONLY. Not built.** Revised 2026-10-24. Line numbers were re-verified that day
against `biowellth-website` `1bb00af`, which is still `origin/main` (no commit has touched
`index.html` since), and against `biowellth-backend-supa` `27bb0e0`. Re-check them before editing.

**Gate.** Nothing here is built until counsel clears it under condition 6. Privacy policy v1.3
does not cover a website signup: `privacy.html:158` covers account holders only, `:179` limits
Resend to transactional account emails, and `:194` stores "account and wellness information" with
Supabase. The request is `docs/counsel-request-waitlist-2026-10.md`.

**Scope.** The inline form is a **separate, website-only signup alongside the Typeform**. The
Typeform is not touched. Specifically, this plan makes **no edit** to:

- the Typeform iframe (`index.html:801`) or popup (`:804`)
- `TYPEFORM_UTM_HIDDEN_V1/V2` (`:806-859`) or the embed script (`:1510`)
- the early-access page (`:791-884`) or `waitlist/index.html`
- the Sentry `denyUrls` (`index.html:1702`, `dashboard.html:2649`)

The mock is `mocks/waitlist-inline.html` (untracked). It shows **both placements**: the hero
(`index.html:570-573`, over the orb, with the glass button wrapping beneath) and the final CTA
(`:768-785`). It also shows all seven states. Both placements were checked over CDP at a true 375px
and at 1280px:
- no horizontal overflow
- the privacy line sits under the hero form, with the glass button beneath it
- the hero form is no wider than 460px
- the pill stacks at 375px
- every text over the orb clears 4.5:1

## 1. Decisions recorded (Aditi, 2026-10-24)

- **Placement.** One form in the homepage hero and one in the final CTA, each replacing its "Join
  the waitlist" button's jump to `/early-access`. The nav "Join the waitlist" button scrolls to the
  final CTA form. The early-access page and its Typeform stay as they are, still reachable at
  `/early-access`, `/waitlist` and `science.html:272`.
- **Four UTM keys:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, plus `referrer`
  and `created_at`. The form reads the same keys and the same rule as `TYPEFORM_UTM_HIDDEN_V1`
  (`index.html:843`): lowercased, kept only if the whole value matches `^[a-z0-9_.-]{1,64}$`,
  otherwise empty, and absent means empty. It adds `utm_campaign`, which `waitlist/index.html`
  already passes through untouched, so links via `/waitlist` keep working with no change there.
- **`signup_source = 'website_inline'`** on every row, so these rows can later be told apart from
  Typeform signups.
- **Two optional one-tap question sets in the welcome email**, interest and region, stored as
  nullable `interest_tag` and `region_tag`.
- **Retention: counsel to confirm.** There is an unsubscribe link in the welcome email and a
  delete-on-request route.
- **Glass backing on the hero privacy line and error message (Aditi, 2026-10-24).** In the hero,
  both texts sit on the orb instead of a glass panel. Measured over the static pearl in the mock:

  | Hero text | Bare, 375px | Bare, 1280px | With glass, 375px | With glass, 1280px |
  |---|---|---|---|---|
  | Privacy text (`--ink-muted`) | 2.51:1 | 4.46:1 | 5.93:1 | 6.36:1 |
  | Privacy link (`--coral-deep-text`) | 2.18:1 | 3.88:1 | 5.16:1 | 5.53:1 |
  | Error message (`--coral-deep-text`) | 2.20:1 | 3.99:1 | 5.04:1 | 5.57:1 |

  - The fix is a chip at the site's existing `--glass` with `--glass-edge`. It is a pill behind the
    privacy line, and a 16px-radius box behind the error message, which can wrap.
  - The text and type stay exactly as `.final-privacy` and `.wl-msg`.
  - The final CTA's line already sits on the `.final-panel` glass and measured 5.10:1 or better.
  - The numbers are against `pearl.png`. Phase B re-measures on the live WebGL orb.

## 2. Tables (backend migration `0076_waitlist.sql`)

```sql
-- WAITLIST_INLINE_V1. Website-only waitlist signups. The Typeform is separate and untouched.
-- Written only by the waitlist-signup edge function (service_role). No anon or authenticated
-- access. No policies, so RLS denies every non-service role.
create table public.waitlist (
  id                uuid primary key default gen_random_uuid(),
  email             text not null check (email = lower(email) and length(email) between 3 and 254),
  signup_source     text not null default 'website_inline'
                      check (signup_source in ('website_inline')),
  utm_source        text not null default '' check (length(utm_source)   <= 64),
  utm_medium        text not null default '' check (length(utm_medium)   <= 64),
  utm_campaign      text not null default '' check (length(utm_campaign) <= 64),
  utm_content       text not null default '' check (length(utm_content)  <= 64),
  referrer          text not null default '' check (length(referrer)     <= 200),
  created_at        timestamptz not null default now(),
  -- Unsubscribe, delete and tagging all key on this token. Never shown anywhere but the email.
  unsubscribe_token uuid not null default gen_random_uuid(),
  welcome_sent_at   timestamptz,
  -- Optional one-tap answers from the welcome email. NULL means never answered.
  interest_tag      text check (interest_tag in ('hormones_cycle','energy','gut','metabolism','skin_hair')),
  region_tag        text check (region_tag in ('bangalore','mumbai','delhi_ncr','chennai','hyderabad',
                                                'pune','kolkata','india_other','us','uk','outside_other')),
  tagged_at         timestamptz
);
create unique index waitlist_email_key on public.waitlist (email);
create unique index waitlist_unsubscribe_token_key on public.waitlist (unsubscribe_token);

-- Per-IP rate limit. ip_hash is sha256(WAITLIST_IP_SALT || ip), never the raw IP.
-- Rows older than one day are deleted on every call, so nothing here outlives 24h.
create table public.waitlist_rate (
  ip_hash      text not null,
  window_start timestamptz not null,
  hits         int not null default 1,
  primary key (ip_hash, window_start)
);

alter table public.waitlist      enable row level security;
alter table public.waitlist_rate enable row level security;

-- DEFAULT_PRIVS_V1 (backend CLAUDE.md): revoke first, BY NAME, then grant the minimum back.
revoke all on public.waitlist      from anon, authenticated, service_role, public;
revoke all on public.waitlist_rate from anon, authenticated, service_role, public;
grant select, insert, update, delete on public.waitlist      to service_role;
grant select, insert, update, delete on public.waitlist_rate to service_role;

-- One round trip, atomic. Returns this window's hit count after counting this one.
create function public.waitlist_rate_hit(p_ip_hash text) returns int
language sql security invoker set search_path = public as $$
  with purge as (delete from public.waitlist_rate where window_start < now() - interval '1 day')
  insert into public.waitlist_rate as r (ip_hash, window_start, hits)
  values (p_ip_hash, date_trunc('hour', now()), 1)
  on conflict (ip_hash, window_start) do update set hits = r.hits + 1
  returning hits;
$$;
revoke all on function public.waitlist_rate_hit(text) from anon, authenticated, service_role, public;
grant execute on function public.waitlist_rate_hit(text) to service_role;
```

- **`signup_source`'s CHECK allows only `'website_inline'` today.** If Typeform rows are ever
  brought in, widening it is its own migration and its own counsel question. Nothing here imports
  them.
- **The tag values are stored codes, not labels.** The labels live in the email copy (4d), so
  rewording a label never changes stored data. The region set is the city list Aditi approved on
  2026-10-24: 11 codes, 7 of them Indian cities. Adding a city later is a CHECK change, so its own
  migration.
- **Email is unique and lowercased**, enforced twice: the function lowercases it, and the CHECK
  refuses anything that is not already lowercase.
- **Referrer is stored as an origin only** (`https://www.linkedin.com`), never a path or query.
  When someone arrives via `/waitlist`, the referrer reads `https://biowellth.ai`, because that
  redirect has already recorded the source in `utm_source`.
- **First touch wins.** A duplicate signup changes nothing, including its tags.
- **Applied how.** DDL goes through the claude.ai Supabase connector (`apply_migration`, as
  `postgres`) under the founder-approved brief, recorded in the migration's docs entry (backend
  CLAUDE.md:122).
- **Read back:** `information_schema.columns`, the CHECK definitions from `pg_constraint`,
  `pg_indexes`, `pg_class.relrowsecurity`, `pg_policies` (expect zero rows),
  `information_schema.role_table_grants` (expect `service_role` only), and
  `pg_get_functiondef` with `routine_privileges` for `waitlist_rate_hit`.

## 3. RLS

RLS is on with **no policies**, and `anon` and `authenticated` have no grants, so there is no
public select and no public write. The only writer is `waitlist-signup` with the service-role key.

## 4. Edge function `waitlist-signup`

`supabase/functions/waitlist-signup/index.ts`, with the pure parts in `validate.ts` and the email in
`welcome-email.ts`, so the Deno tests need no network. **One function, three routes**, so Phase B
is still one deploy.

**`verify_jwt = false`, declared in `supabase/config.toml`** in a `[functions.waitlist-signup]`
block, never as a deploy flag (backend CLAUDE.md:490-495). Mail providers' one-click unsubscribe
POSTs carry no JWT, and an anon key in front of a public form protects nothing. The protections are
CORS, the honeypot, the rate limit and the token.

**CORS.** `Access-Control-Allow-Origin` is `https://biowellth.ai` only. OPTIONS answers 204.

**Logging.** The email address and the token are never logged. Logs carry outcome codes only.

**Rate limit.** All three routes share it. The IP comes from the first entry of
`x-forwarded-for`, and `ip_hash = sha256(WAITLIST_IP_SALT + ip)` is passed to
`rpc('waitlist_rate_hit')`. **More than 20 calls in the hour across all routes returns 429**, and
signup alone is capped at 5. With no IP present, the limit is skipped and that fact is logged.

### 4a. `POST /functions/v1/waitlist-signup` (signup)

Body: `{email, utm_source, utm_medium, utm_campaign, utm_content, referrer, company}`. `company` is
the honeypot.

1. A body over 2 KB returns 400.
2. **Honeypot.** If `company` is non-empty, return `200 {ok:true, notice:"inbox"}` with no row
   and no email.
3. **Rate limit**, as above.
4. **Validate.** Trim, lowercase, length 3 to 254, no whitespace or control characters, matching
   `^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$`. Failure returns `400 {error:"invalid_email"}`. UTMs are
   re-checked against the allowlist and `referrer` is reduced to an origin, otherwise each is
   stored empty. `signup_source` is set by the server and never read from the body.
5. **Insert.** `insert ... on conflict (email) do nothing returning id, unsubscribe_token`.
   - **New row:** send the welcome email (4d). On success, set `welcome_sent_at` and return
     `200 {ok:true, notice:"inbox"}`. If Resend fails, keep the row and return
     `200 {ok:true, notice:"listed"}`, so the page does not say "Check your inbox" (mock state 7).
   - **Duplicate:** return `200 {ok:true, notice:"inbox"}` and send **no second email**. The
     answer matches a new signup, so the form cannot reveal whether an address is listed, or be
     used to flood someone's inbox.
6. Anything else returns `500 {error:"server"}`.

### 4b. `POST /functions/v1/waitlist-signup/tag` (the waitlist-tag endpoint)

Body: `{t, set, value}`. `set` is `"interest"` or `"region"`, `value` is one stored code from
section 2, and `t` is the unsubscribe token.

- Validate `t` as a UUID, and `set` and `value` against the allowlists. Anything else returns 400.
- `update waitlist set interest_tag = $v, tagged_at = now() where unsubscribe_token = $t returning id`
  (or `region_tag`). **The last tap wins**, so tapping a different answer changes it.
- Returns `200 {ok:true, saved:true}`, or `{ok:true, saved:false}` when no row matched (removed or
  never existed). The token is a random UUID, so this reveals nothing to someone without the
  email.
- **GET returns 405.** Tag writes are POST only, made by the thank-you page (4e).

### 4c. `POST /functions/v1/waitlist-signup/unsubscribe` (unsubscribe, which is also delete)

- `?t=TOKEN` in the URL (the one-click unsubscribe header form) or `{t}` in the body (the confirm
  page). It runs `delete from waitlist where unsubscribe_token = $1` and returns 200 whether or not
  a row matched. Deleting the row removes the tags with it.
- **GET returns 405.** Mail link scanners prefetch GET links, so a deleting GET would remove people
  who never clicked.

### 4d. Welcome email (existing Resend setup)

- Uses the same `RESEND_API_KEY` as `review-action` (`review-action/index.ts:34`) and the same
  sender as `RELEASE_FROM`, `BioWellth <no-reply@send.mybiowellth.com>`
  (`review-action/release-email.ts:13`). The module is shaped like `release-email.ts`, with both
  an HTML and a text part.
- Headers: `List-Unsubscribe: <https://clacgutnrktdwhglvyua.supabase.co/functions/v1/waitlist-signup/unsubscribe?t=TOKEN>, <mailto:support@mybiowellth.com?subject=unsubscribe>`
  and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- **Answer links** go to `https://biowellth.ai/waitlist-tag?t=TOKEN&set=interest&v=energy` and so
  on. There are **16 in all: 5 interest and 11 region**. **The removal link** goes to
  `https://biowellth.ai/unsubscribe?t=TOKEN`.
- **Resend click tracking must be off** for this sending domain. With it on, Resend rewrites every
  link through its tracking domain, so each tap would also be recorded at Resend. Check the domain
  setting before the first send and record what it was.
- **Copy. APPROVED 2026-10-24 (Aditi).** It is pinned verbatim below, and
  `welcome-email.test.ts` asserts it byte for byte. Changing it is a product decision, not an edit.
  - The blocks below hold only the copy. Labels such as subject and body sit outside them.
  - Checked 2026-10-24: no colons, no em dashes (U+2014) and no en dashes (U+2013) in any block.
  - Each answer line is one link. The removal link is the word "here".
  - The HTML part is the same text, with each answer as a link and the questions in bold.

  Subject

  ```text
  You're on the BioWellth waitlist
  ```

  Body

  ```text
  Thank you for joining the BioWellth waitlist. Early access opens in small groups, and we'll email you when there's a place for you.

  BioWellth reads your full blood panel against functional ranges, tracks how it changes over time, and Sana helps you understand what it means for you.

  Two quick questions, if you'd like to help us plan. Tap one answer for each. Both are optional, and you can change an answer by tapping a different one. We use your answers only to plan early access.

  What do you most want to understand about your body?
  Hormones and cycle
  Energy
  Gut
  Metabolism
  Skin and hair

  Where do you live?
  Bangalore
  Mumbai
  Delhi NCR
  Chennai
  Hyderabad
  Pune
  Kolkata
  Elsewhere in India
  US
  UK
  Elsewhere outside India

  If you didn't sign up, or you'd rather not hear from us, you can remove yourself from the waitlist here. That deletes your email and your answers from our list.

  BioWellth
  ```

  Answer label to stored code

  | Set | Label | Code |
  |---|---|---|
  | interest | Hormones and cycle | `hormones_cycle` |
  | interest | Energy | `energy` |
  | interest | Gut | `gut` |
  | interest | Metabolism | `metabolism` |
  | interest | Skin and hair | `skin_hair` |
  | region | Bangalore | `bangalore` |
  | region | Mumbai | `mumbai` |
  | region | Delhi NCR | `delhi_ncr` |
  | region | Chennai | `chennai` |
  | region | Hyderabad | `hyderabad` |
  | region | Pune | `pune` |
  | region | Kolkata | `kolkata` |
  | region | Elsewhere in India | `india_other` |
  | region | US | `us` |
  | region | UK | `uk` |
  | region | Elsewhere outside India | `outside_other` |

  The text part needs each answer's URL visible. It goes on its own line under the label, so the
  copy above is unchanged.

### 4e. Website pages for the email links (website repo, new files)

Supabase serves function HTML on `*.supabase.co` as `text/plain`, so both pages live on the site.
Both are static, `noindex`, use the site's tokens and fonts, and send nothing to Sentry beyond
the existing error-only setup.

- **`waitlist-tag/index.html`** reads `t`, `set` and `v` from the URL, **POSTs to 4b from script on
  load**, and then shows:
  - saved: "Thank you. That helps us plan early access."
  - `saved:false`: "You're no longer on the waitlist, so nothing was saved."
  - error: "Something went wrong and your answer wasn't saved. Please tap the link again."
  - It then replaces the URL with the bare path, so the token is not left in history.
- **Why a page that POSTs, not a link that writes.** Link scanners fetch GET URLs without running
  script, so most scanners never record an answer. **Known limitation:** scanners that do run
  script (some corporate mail filters) could record an answer nobody chose. The tags are planning
  data only, nothing acts on them per person, and the last tap wins, so a real tap later
  overwrites a scanner's. This is accepted, not solved.
- **`unsubscribe/index.html`** has one button, "Remove me from the waitlist". It POSTs to 4c and
  then says "You've been removed from the waitlist. Your email and your answers have been deleted."
  It needs a tap because removal is not reversible.

### 4f. Delete on request

Requests to support@mybiowellth.com follow a runbook in the backend repo,
`docs/waitlist-delete-request.md`:
`delete from public.waitlist where email = lower(trim($1)) returning id, created_at;` through the
connector, a read-back select returning zero rows, a reply to the requester, and a log line with
date and outcome only. The runbook also lists the copies outside our database:
- Resend's sent-email logs, kept for its own retention period
- the person's Typeform response, if they also used the Typeform, deleted by hand in the Typeform
  admin (no code change)

### 4g. Retention: counsel to confirm

- Period: **[RETENTION: counsel to confirm]**.
- Mechanism: a nightly `pg_cron` job, `waitlist-retention-nightly`, running
  `delete ... where created_at < now() - interval '[RETENTION]'`. **It ships disarmed**, with an
  empty body (backend CLAUDE.md:449-454, the 0029 and 0032 lesson), and is armed in its own commit
  once counsel sets the period.
- `waitlist_rate` holds nothing past 24 hours, by construction.

### 4h. Secrets, tests, deploy

- **Secrets.** `RESEND_API_KEY` exists already. Add `WAITLIST_IP_SALT` (32 random bytes) with
  `supabase secrets set`, and never print it.
- **`validate.test.ts`** covers:
  - email normalisation and rejection, the UTM allowlist, and referrer reduced to an origin
  - the honeypot, duplicates answering like new signups, and a failed mail answering `listed`
  - tag set and value allowlists, and that GET returns 405 on `tag` and `unsubscribe`
  - that `signup_source` from the body is ignored
- **`welcome-email.test.ts`** covers:
  - the headers
  - the subject and body byte-identical to 4d
  - **exactly 16 answer links (5 interest, 11 region)**, each carrying the token and a code allowed
    by the CHECK
  - no colons, em dashes or en dashes in the copy
- **Deploy:**
  `supabase functions deploy waitlist-signup --project-ref clacgutnrktdwhglvyua`. Run
  `list_edge_functions` before and after: **`shen-token` must still be version 2**, every other
  version unchanged, and exactly one new slug.

## 5. `index.html` insertion points (verified 2026-10-24 at `1bb00af`)

| # | Line(s) now | Change |
|---|---|---|
| a | after `:388` (`.final-privacy a{...}`) | Add the `.wl-*` rules from the mock's `WAITLIST_INLINE_V1` block. The container query stacks the pill under 400px of form width, wherever the form sits. |
| b | `:550` nav button `<a href="#" onclick="showPage('early-access')" class="btn btn-ink nav-cta">` | Becomes `<a href="#join" class="btn btn-ink nav-cta">`, with the onclick removed. `#join` is the final CTA section (`:768`). `#sana` at `:547` already works this way: `route()` scrolls to the section via `goToSection()` (`:946`), and from `/early-access` it goes home first (`:984-999`). `[id]{scroll-margin-top:96px}` (`:184`) clears the nav. The label stays. |
| c | `:571` hero button `<a href="#" onclick="showPage('early-access')" class="btn btn-ink">` | Replace it with `<div class="wl-hero">` holding form instance 1, its done message and a `.final-privacy` line, inside `.hero-ctas` (`:570`). "How we read a panel" (`:573`) stays where it is. `.wl-hero` is `flex:0 0 100%`, so the glass button always wraps beneath it. The form is capped at 460px and centred. **Mocked and verified** (see the note below the table). |
| d | `:776-778` the `HOMEPAGE_MOTION_V1` comment | **Supersede it, do not delete it.** Keep the text and add "SUPERSEDED by WAITLIST_INLINE_V1: a website signup endpoint now exists (waitlist-signup). The Typeform on /early-access is unchanged." |
| e | `:779-781` the `.cta-pill` div and its button | Replace with form instance 2 (the mock's markup). `.lede` (`:775`) and `.final-privacy` (`:782`) stay. |
| f | before `:1510` (the Typeform embed script, **left untouched**) | Add one `<script>` (`WAITLIST_INLINE_V1`) that binds every `.wl-form`, with unique ids per instance. It reads the four UTM keys and the referrer origin, validates, and POSTs to `.../functions/v1/waitlist-signup`. It maps 200 inbox, 200 listed, 400, 429 and anything else to the mock's states. Placing it before the embed script means a Typeform load failure cannot stop it, and it never reads or writes anything the Typeform blocks use. |

- **Hero privacy line and error message need a glass backing.** The hero form has the same
  "Your data is yours. Never sold. Privacy Policy" line, with the same text and type as
  `.final-privacy`. In the hero it sits on the orb, not on a glass panel.
  - Measured bare over the static pearl in the mock: **2.51:1 text and 2.18:1 link at 375px, 4.46:1
    and 3.88:1 at 1280px**. The error message (`.wl-msg`) measured 2.20:1 and 3.99:1. All are under
    4.5:1.
  - The mock gives both a chip at the site's existing `--glass`, the value `index.html` tunes for
    small text over the orb. Measured after: privacy text 5.93 and 6.36:1, link 5.16 and 5.53:1,
    error 5.04 and 5.57:1. The final CTA's line is already on glass and measures 5.10:1 or better.
  - These numbers are against `pearl.png`. The live hero draws the orb in WebGL, so Phase B
    re-measures on the live render.
  - If counsel asks for wording at the field (question 2), it replaces this line in both
    placements.
- **No-JS.** Both forms carry `hidden` in the markup and the script removes it once bound. A form
  without its script would submit as a GET with the address in the URL, so it is not rendered at
  all.
- **Unique live marker.** Each form carries `data-wl="inline-v1"`. Phase B's live check is
  `curl https://biowellth.ai | grep -c 'data-wl="inline-v1"'`, which should return 2.
- **Tests.** Add `scripts/test-waitlist-inline.mjs` in the repo's Chrome-over-CDP pattern. It
  checks:
  - every state, for both instances
  - the UTM sanitising
  - the honeypot is off screen and sent
  - no `@` is ever in `location.href`
  - the nav `#join` scroll lands on the form
  - no horizontal overflow at a true 375px
  - **that the Typeform iframe `src`, the popup's `data-tf-hidden` and the `embed.js` tag are
    byte-identical to `1bb00af`**, as a guard that this change never touched them
  `scripts/test-leftovers-palette.mjs` must stay green.

## 6. Phase B order (one verifiable change per commit, explicit-path `git add`)

Backend first, so the forms never point at a missing endpoint.

1. Backend: take `docs/.session-lock`.
2. Backend: `migrations/0076_waitlist.sql` plus its docs entry. Apply it, then read back and paste
   the output.
3. Backend: the `waitlist-signup` function, its tests and the `config.toml` block, plus
   `docs/waitlist-delete-request.md`. Set the secret, check Resend click tracking, and deploy.
   Confirm shen-token v2. Then curl through:
   - a new address (row with `signup_source = website_inline`, email arrives)
   - a duplicate (no second email)
   - the honeypot (no row)
   - a tag POST (tag stored)
   - an unsubscribe POST (row gone)
4. Website: take `docs/.session-lock`.
5. Website: `waitlist-tag/index.html` and `unsubscribe/index.html`.
6. Website: wire `index.html` (a to f) plus `scripts/test-waitlist-inline.mjs`. Push (the deploy),
   then:
   - run the live grep and `scripts/check-live-exclusions.mjs`
   - sign up end to end from biowellth.ai with UTMs, and confirm the row, its tags and the welcome
     email
   - tap one interest and one region link, and confirm both tags
   - delete the test row and read back zero rows
7. Release both locks.

## Not in scope

- **Any change to the Typeform** or anything around it (listed under Scope above).
- Importing Typeform signups.
- The invite flow.
- Any reporting on the tags.
