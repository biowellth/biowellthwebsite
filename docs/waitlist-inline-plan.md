# WAITLIST_INLINE_V1 plan

Status, 2026-10-24: **Stage B1 and stage B2 are built and live.** On 2026-10-24 the founder
dropped the counsel gates: counsel reviews everything once, at the end of the build. **Counsel
review of v1.4 is pending, batched for the end of the build.** Privacy policy v1.4 was published to
`privacy.html` (effective October 24, 2026), and the inline forms went live, before counsel saw the
final v1.4 text. Counsel's own launch conditions put v1.4 first. Sequencing is the founder's call
and is recorded here so it is not mistaken for a sign-off.

**Counsel's ruling** is `biowellth-backend-supa`
`docs/evidence/counsel-reply-waitlist-2026-10.md`. Part A (email-only) is approved with
conditions, and Part B's interest question is deferred. The original request is
`docs/counsel-request-waitlist-2026-10.md`.

**Line numbers** were re-verified on 2026-10-24 against `index.html` and `dashboard.html` as last
changed at `f8fdde7`. No commit has touched either file since `1bb00af`. Re-check them before B2
edits anything.

**Scope.** The website goes inline, email-only. **B2 removes the Typeform from the website
entirely**:
- the iframe and the popup
- `TYPEFORM_UTM_HIDDEN_V1/V2`
- the embed script
- the Sentry `denyUrls`

Only the website stops using it. **The Typeform form `t0eULTZa` and all its responses are preserved,
untouched.** Nothing is migrated out of it and nothing is deleted from it, by code or runbook, except
one case: when a removal request names someone with a Typeform response, the founder deletes that
response by hand (backend `docs/waitlist-delete-request.md`, A2).

**The mock** is `mocks/waitlist-inline.html` (untracked). It shows both homepage placements and
every state, checked at a true 375px and at 1280px. It still shows the old privacy line and has no
early-access-page instance. Both are B2 mock updates (section 5).

## 1. Decisions and rulings

**Founder decisions (Aditi, 2026-10-24)**
- **Placement.** One form in the homepage hero and one in the final CTA. The nav "Join the
  waitlist" button scrolls to the final CTA form. B2 adds a third instance on the early-access page,
  where the Typeform was, because `/early-access`, `/waitlist` and `science.html:272` all land there.
- **Four UTM keys**, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, plus `referrer`
  and `created_at`. The form reads them with the rule `TYPEFORM_UTM_HIDDEN_V1` used
  (`index.html:843`): lowercased, kept only if the whole value matches `^[a-z0-9_.-]{1,64}$`,
  otherwise empty, and absent means empty. `waitlist/index.html` needs no change.
- **`signup_source = 'website_inline'`** on every row. The CHECK allows only that value. Typeform
  records are not imported (founder amendment, 2026-10-24).
- **Glass backing on hero texts over the orb.** These are the privacy line, the error message and
  the "How we read a panel" text link. The numbers are in section 5c.

**Counsel's rulings, as implemented**

| Ruling | Implemented as | Status |
|---|---|---|
| Email-only Part A | The inline form. The function takes only email, tags, referrer and honeypot. | Backend live (B1). Website in B2. |
| Interest question DEFERRED | No `interest_tag` column, no interest codes, links or copy anywhere. The tag route refuses `hormones_cycle` (live 400). | Done (B1) |
| City optional, purpose stated | `region_tag` (11 city codes). The email says "It's optional, and we use your answer only to plan where early access opens first." | Done (B1) |
| Delete 12 months after signup | `waitlist-retention-nightly`, 03:53 UTC, **ARMED** | Done, proven on a synthetic row |
| Delete earlier on account creation | The same job, matching lowercased email against `auth.users` | Done, proven against the E2E account |
| Delete earlier on invitation | Manual, backend runbook section B | Runbook written |
| The removal link deletes the record | `POST /unsubscribe` deletes the row. GET refuses. | Done, proven live |
| The IP hash is for abuse prevention only and expires as stated | Purged once its hour has passed (hourly job and every call). No hash outlives 24 hours. | Done, proven (section 4g) |
| Signup notice under the button | "We'll email you about early access. You can remove yourself at any time. Privacy Policy." in every placement | B2 |
| Welcome email limited to the signup and what happens next | The product paragraph was removed (founder, 2026-10-24). Only the signup, what happens next, the optional city question and removal remain. | Done, deployed as waitlist-signup v2 |
| Typeform disposition | **Retained in Typeform, not migrated, not deleted, used only for early-access invitations within 12 months of each signup.** v1.4 as published says "Responses submitted through Typeform before October 24, 2026 are kept in Typeform and used only to invite people to early access", with no retention number (founder, 2026-10-24). | Recorded. See the finding in 4g. |

## 2. Tables, as built (backend `migrations/0076_waitlist.sql`)

The migration was applied and read back on 2026-10-24 (backend `docs/migration-0076-readback.md`).
In short:

- **`public.waitlist`:**
  - `id`, `email` (unique, CHECK lowercased, 3 to 254 characters)
  - `signup_source` (CHECK `'website_inline'` only)
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` (at most 64 each)
  - `referrer` (an origin only, at most 200)
  - `created_at`, `unsubscribe_token` (unique random UUID), `welcome_sent_at`
  - `region_tag`, nullable, with a CHECK of `bangalore, mumbai, delhi_ncr, chennai, hyderabad, pune,
    kolkata, india_other, us, uk, outside_other`
  - `tagged_at`
- **`public.waitlist_rate`:** `ip_hash` (CHECK 64 hex characters), `window_start` (the clock hour)
  and `hits`.
- **Grants and RLS:** RLS is on with no policies. `service_role` holds select, insert, update and
  delete on both tables, and nothing else holds any grant.
- **Functions:** `waitlist_rate_hit(text)` is executable by `service_role` only.
  `waitlist_rate_purge()` and `waitlist_retention_run()` are executable by no API role; pg_cron runs
  them as `postgres`.
- **Jobs, both ARMED:** `waitlist-retention-nightly` (`53 3 * * *`) and `waitlist-rate-purge-hourly`
  (`7 * * * *`).

Design points that still hold:
- **Tags are stored codes, not labels.** Rewording a label never changes data. Adding a city is a
  CHECK change, so its own migration.
- **The referrer is an origin only.** Via `/waitlist` it reads `https://biowellth.ai`, because that
  redirect has already recorded the source in `utm_source`.
- **First touch wins.** A duplicate changes nothing.

## 3. RLS

RLS is on with no policies, and there are no `anon` or `authenticated` grants, so there is no public
read or write. The only writer is `waitlist-signup` with the service-role key.

## 4. Edge function `waitlist-signup`, as built and deployed

Backend files: `supabase/functions/waitlist-signup/` contains `index.ts` (wiring), `handler.ts`
(routes), `validate.ts` and `welcome-email.ts`, with 21 Deno tests in `waitlist-signup.test.ts`.

**Deployed** 2026-10-24 as **version 1, `verify_jwt: false`**, from backend `a3b9020` with
`supabase functions deploy waitlist-signup --project-ref clacgutnrktdwhglvyua`. Every other
function's version was unchanged, and **shen-token is still v2**.

- **`verify_jwt = false`**, declared in `supabase/config.toml`. Mail providers' one-click POSTs
  carry no JWT, and an anon key protects nothing on a public form.
- **CORS:** `Access-Control-Allow-Origin: https://biowellth.ai` only (verified live).
- **Logs:** outcome codes only. Verified live: `new`, `dup`, `honeypot`, `invalid`, `city_saved`,
  `city_no_row`, `unsubscribed`, `unsubscribe_no_row` and `limited`. No address and no token.
- **Rate limit:** 10 calls per salted IP hash per clock hour, across signup and the city tag
  together. The 11th returns 429 (verified live). **Unsubscribe is exempt**: it needs a valid
  random token, and mail providers' one-click POSTs come from a few shared IPs, so a limit there
  would block real removals. With no IP present, the limit is skipped and that is logged.
- **The salt.** `WAITLIST_IP_SALT` when set. Otherwise it is
  `sha256("biowellth-waitlist-ip-salt-v1:" + service-role key)`, derived inside the function. The
  CLI's Management token lacks `edge_functions_secrets_write`, and setting a secret any other way
  would have routed its value through a transcript. With no salt at all, the handler fails closed
  with a 500.

### 4a. `POST /functions/v1/waitlist-signup` (signup)

Body: `{email, utm_source, utm_medium, utm_campaign, utm_content, referrer, company}`.

The order is: the body (over 2 KB returns 400), then the rate limit, then the honeypot (a non-empty
`company` answers success, with no row and no email), then validation (400 `invalid_email`), then
the insert, which is `on conflict (email) do nothing`.

- **New row:** the welcome email is sent, then `welcome_sent_at` is set, and the answer is
  `{ok:true, notice:"inbox"}`. If Resend fails, the row stays and the answer is
  `{ok:true, notice:"listed"}`.
- **Duplicate:** `{ok:true, notice:"inbox"}` and **no second email**. The answer is identical to a
  new signup.
- `signup_source` is never read from the body. Proven live: a body claiming `typeform` stored
  `website_inline`.

### 4b. `POST /functions/v1/waitlist-signup/tag` (city tag)

Body: `{t, city}`. `t` is the unsubscribe token and `city` is one of the 11 codes. Anything else is
400, including `hormones_cycle`. The last tap wins. The answer is `{ok:true, saved}`, where `saved`
is false when no row matched. GET returns 405.

### 4c. `POST /functions/v1/waitlist-signup/unsubscribe` (removal, which is deletion)

The token comes from `?t=` (RFC 8058 one-click, form-encoded body) or from a JSON body `{t}`. It
deletes the row, tag included, and answers `{ok:true}` whether or not a row matched. GET returns
405.

### 4d. Welcome email

- **Sender and key:** the same as review-action's release email, `BioWellth
  <no-reply@send.mybiowellth.com>` with `RESEND_API_KEY`.
- **Headers:** `List-Unsubscribe` pointing at the function's unsubscribe URL plus a `mailto:`, and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- **Links:**
  - 11 city links: `https://biowellth.ai/waitlist-tag?t=TOKEN&city=CODE`
  - the removal link, the word "here": `https://biowellth.ai/unsubscribe?t=TOKEN`
- **Resend click tracking must be off** for this sending domain, or every tap is also recorded at
  Resend. **Not yet checked.** The local credentials cannot read Resend's domain settings. Check it
  in the Resend dashboard before B2.
- **Copy. APPROVED 2026-10-24 (Aditi).** It was amended the same day, in two steps:
  - for counsel's rulings: the interest question was removed, a one-question paragraph now states
    the purpose, and "your answers" became "your answer"
  - by the founder: the product paragraph ("BioWellth reads your full blood panel...") was removed,
    so the email stays limited to the signup and what happens next, as counsel asked

  `waitlist-signup.test.ts` pins the copy byte for byte (`WL-E1`), guards against the product
  paragraph coming back (`WL-E1b`), and checks for no colons, em dashes or en dashes (`WL-E2`) and
  exactly 11 city links with no interest wording (`WL-E3`). The live version is waitlist-signup v2.

  Subject

  ```text
  You're on the BioWellth waitlist!
  ```

  Body

  ```text
  Thank you for joining the BioWellth waitlist. Early access opens in small groups, and we'll email you when there's a place for you.

  Have a question? Just reply to this email.

  One quick question, if you'd like to help. It's optional, and we use your answer only to plan where early access opens first. Tap one answer, and tap a different one to change it.

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

  If you didn't sign up, or you'd rather not hear from us, you can remove yourself from the waitlist here. That deletes your email and your answer from our list.

  BioWellth
  ```

  City label to stored code

  | Label | Code |
  |---|---|
  | Bangalore | `bangalore` |
  | Mumbai | `mumbai` |
  | Delhi NCR | `delhi_ncr` |
  | Chennai | `chennai` |
  | Hyderabad | `hyderabad` |
  | Pune | `pune` |
  | Kolkata | `kolkata` |
  | Elsewhere in India | `india_other` |
  | US | `us` |
  | UK | `uk` |
  | Elsewhere outside India | `outside_other` |

  In the text part each URL sits on its own line under its label, so the copy above is unchanged.

### 4e. Website pages for the email links (B2, new files)

Supabase serves function HTML as `text/plain`, so both pages live on the site. Both are static,
`noindex`, and use the site's tokens.

- **`waitlist-tag/index.html`** reads `t` and `city`, **POSTs to 4b from script on load**, and then
  replaces the URL with the bare path. It shows:
  - saved: "Thank you. That helps us plan where early access opens first."
  - `saved:false`: "You're no longer on the waitlist, so nothing was saved."
  - error: "Something went wrong and your answer wasn't saved. Please tap the link again."
- **Why a page that POSTs.** Link scanners fetch GET URLs without running script. **Known
  limitation:** scanners that do run script could record an answer nobody chose. City is planning
  data only, and a real tap overwrites it.
- **`unsubscribe/index.html`** has one button, "Remove me from the waitlist". It POSTs to 4c and
  then says "You've been removed from the waitlist. Your email and your answer have been deleted."

### 4f. Removal requests and invitations

Both follow backend `docs/waitlist-delete-request.md`:
- **A removal request** covers both places. The Supabase row is deleted by SQL and read back as 0,
  and **the founder deletes that person's Typeform response by hand**.
- **An invitation** deletes a website signup's row after the invite is sent. Nothing is deleted
  from Typeform on invitation.

Resend's own sent-email logs are outside both places.

### 4g. Retention and the IP hash, as built

- **12 months after signup, or account creation:** the nightly job, ARMED. Proven on synthetic
  rows: `{"expired_12_months":1,"has_account":1}`, and the fresh row survived.
- **Invitation:** manual, by the runbook.
- **IP hash.** Its purpose is abuse prevention only: the signup and city-tag rate limit. It is
  never joined to a waitlist row, never logged, and never used for anything else.
  - **Deletion window:** a row is purged once its one-hour window has passed, by the hourly job and
    by every rate-limit call. So no hash outlives 24 hours, and in practice none lasts much over two.
  - Proven on synthetic rows: rows 25 hours and 3 hours old were purged and the current hour kept,
    and the per-call purge removed a 5-hour-old row.
  - The live scheduled run is recorded in backend
    `docs/evidence/waitlist-b1-verification-2026-10-24.md`.
- **Typeform retention, resolved in the text.** The draft's "under the 12-month retention rule"
  was dropped. v1.4 as published gives no retention number for Typeform responses (founder,
  2026-10-24), so it promises nothing that no step carries out. Counsel's disposition line above
  still says "within 12 months of each signup". That is a use limit, and it is not enforced by any
  code or step. **Raise it with counsel at the end review.**
- **Finding, 2026-10-24: the Typeform collected health information.** The form's own questions were
  read from the public form while writing v1.4. Besides name, email, phone, age range and city, it
  asked:
  - which symptoms are "showing up for you right now"
  - whether symptoms were dismissed, with free text about it
  - how the person tracks their health

  That is the category counsel flagged for the deferred interest question (possible consumer
  health data under Washington's My Health My Data Act, or special-category data under GDPR or UK
  GDPR). v1.4 names these categories so the past-tense disclosure "accurately reflects the
  historical processing". **For counsel's end review.** It also asked whether the person "would be
  open to a short conversation". Contacting anyone for that would go beyond the published "used
  only to invite people to early access".

## 5. B2 website changes (line numbers verified 2026-10-24, `index.html` and `dashboard.html` at `f8fdde7`)

### 5a. Add the inline form

| # | Line(s) now | Change |
|---|---|---|
| a | after `:388` (`.final-privacy a{...}`) | The `.wl-*` rules from the mock's `WAITLIST_INLINE_V1` block, including `.wl-hero`, the glass chips and `.wl-hero-link`. |
| b | `:550` nav button | `<a href="#join" class="btn btn-ink nav-cta">`, with the onclick removed. `#join` is the final CTA (`:768`), and `route()` and `goToSection()` (`:946`, `:984-999`) handle it from any page, as `#sana` (`:547`) already does. |
| c | `:571` hero button, plus `:573` | `<div class="wl-hero">` holds form instance 1, its done message and the signup notice. "How we read a panel" becomes `class="wl-hero-link"`: olive, 15px / 600, underlined with a 3px offset, a glass chip, and `margin-top:8px`. Measured with the chip: **5.85:1 at 375px and 5.86:1 at 1280px**, against 2.05:1 bare at 375px. |
| d | `:776-778` `HOMEPAGE_MOTION_V1` comment | Supersede it, but **the replacement must not contain the word "typeform"** (5c). For example: "HOMEPAGE_MOTION_V1 said this repo had no email-capture endpoint. SUPERSEDED by WAITLIST_INLINE_V1, which added one (waitlist-signup)." |
| e | `:779-781` `.cta-pill` and its button | Form instance 2. `.lede` (`:775`) stays. `.final-privacy` (`:782`) becomes the signup notice. |
| f | before `:1510` | One `<script>` (`WAITLIST_INLINE_V1`) that binds every `.wl-form`, with unique ids, and POSTs to `.../functions/v1/waitlist-signup`. |

### 5b. Remove the Typeform from the website

| # | Line(s) now | Change |
|---|---|---|
| g | `:800-802` `.ea-form-desktop` with the iframe (`:801`) | Remove. Form instance 3 (early-access page) goes here, in a `.final-panel glass`-style card with the signup notice. |
| h | `:803-805` `.ea-form-mobile` with the popup (`:804`) | Remove. |
| i | `:806-859` `TYPEFORM_UTM_HIDDEN_V1/V2`, the comment `:806-836` and the script `:837-859` | Remove. Its UTM rule lives on in the WAITLIST_INLINE_V1 script, which credits the rule's origin without naming the vendor. |
| j | CSS `:409-412`, and `:457-458` and `:460` in the 767px block | Remove `.ea-form`, `.ea-form-mobile`, `.ea-mobile-btn`, `.ea-form iframe`, and their mobile overrides. |
| k | `:1510` the embed script | Remove. |
| l | `index.html:1702` and `dashboard.html:2649` | Remove the `denyUrls` entries. If an array is left empty, remove the property. |
| m | `CLAUDE.md:102` (not served) | Drop "and a Typeform embed on the marketing page". |

### 5c. B2 checks

- **Zero "typeform" in served HTML.** That means comments too, so step (d) rewords rather than
  quotes. The check is `curl -s https://biowellth.ai/ https://biowellth.ai/dashboard ... | grep -ci
  typeform`, which must be 0 for every page in `git ls-files '*.html'`.
- **The signup notice** replaces "Your data is yours. Never sold." in all three placements. It is
  longer, so in the hero it may wrap to two lines inside its chip. **Update the mock first and
  re-measure contrast at 375px and 1280px.** The pill radius may need to become a box radius when
  it wraps, as the error message's did.
- **No-JS.** Each form carries `hidden` and the script removes it once bound.
- **Live marker.** `data-wl="inline-v1"` on each form. The homepage should count 2, plus 1 on the
  early-access page, which is the same document, so 3 in `/`.
- **`scripts/test-waitlist-inline.mjs`** (Chrome over CDP) covers:
  - every state for all three instances, and the UTM sanitising
  - the honeypot is off screen and sent
  - no `@` in `location.href`, and the nav `#join` lands on the form
  - no overflow at a true 375px
  - **no `typeform` in the DOM or in any script src**
  - `scripts/test-leftovers-palette.mjs` stays green
- **End to end from biowellth.ai.** Sign up with UTMs, confirm the row and the welcome email, tap a
  city link and confirm the tag, use the removal link and confirm the row is gone, then read back 0.
- After every push, `scripts/check-live-exclusions.mjs`.

## 6. Order

**B1 (done 2026-10-24).** Counsel evidence, migration 0076 and its read-back, the function and
tests, the derived salt, the deploy, the live curl tests, the runbook, this plan and the
`docs/privacy-v1.4-draft.md`. The commit hashes are in the B1 report.

**B2 (done 2026-10-24, one pass by founder instruction, no mock round).**
1. The welcome email paragraph was dropped and the function redeployed as v2. shen-token is still
   v2 and no other version changed.
2. v1.4 was published in `privacy.html`.
3. The 5a changes and the 5b removal were made as separate commits.
4. The two email-link pages and `scripts/test-waitlist-inline.mjs` (31 checks) were added.
5. Contrast was re-measured on the real page at 375px and 1280px, with both the pearl and the live
   WebGL orb. Every hero text is 5.04:1 or better, and the final CTA notice is 5.14:1 or better.
6. Push, then the 5c checks live. The results and commit hashes are in the B2 report and
   `docs/evidence` in the backend repo.

## End-of-build counsel list

Everything counsel reviews once, at the end of the build (founder instruction, 2026-10-24):

1. **Privacy policy v1.4 as published** in `privacy.html`, effective October 24, 2026. It went live
   before counsel saw the final text (status note at the top).
2. **The old Typeform collected health information**: symptoms, dismissed symptoms with free
   text, and health tracking. v1.4's past-tense disclosure names these categories (section 4g).
3. **The Typeform's "short conversation" question.** Contacting anyone for that would go beyond
   v1.4's "used only to invite people to early access" (section 4g).
4. **Typeform retention.** v1.4 gives no number. The disposition line's "within 12 months of each
   signup" is a use limit that nothing enforces (section 4g).
5. Hero form has no signup notice (founder, 2026-10-24); the notice remains under the final CTA and early-access forms.

## Not in scope

- Importing or deleting Typeform responses (except a removal request, by hand).
- The interest question (deferred by counsel).
- Any marketing or newsletter use of the list (counsel: bring back for review).
- Any reporting on city tags.
