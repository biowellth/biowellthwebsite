# Code comment archive, 2026-10-27

Every CSS and JS comment on a served page of biowellth-website that recorded an internal decision,
approval, ruling, counsel status, person or commit, as it stood at commit `9589626`, before
CODE_COMMENT_CLEANUP_V1 removed it from the page or stripped the reference out of it. Page source is
public, so these notes now live only here. Each entry is under the file and the line the comment
started on at `9589626`. **removed** means the whole comment left the page. **stripped** means the
technical part stayed and only the internal reference was cut, and the entry shows both versions.

**Not changed: the three byte-pinned modules** `js/cycle-movement.js`, `js/food-guard.js` and
`js/phase-note-guard.js`. Each must stay byte-identical to its copies in the backend repos (pinned by
sha256 in test-cycle-movement CM-W1, test-food-guard FG-W1 and test-phase-note-guard PNG-W1, and by the
backend's own tests). Each still carries one dated approval or ruling comment. Cleaning them means
changing every copy and its pin together.

Technical comments with no internal reference were not touched. Neither were the <!-- --> comments,
which already moved to docs/html-comment-archive-2026-10-27.md.

## dashboard.html

### dashboard.html:27 (stripped, css)

~~~~
/* DASHBOARD_V2_DESIGN, 2026-10-13: the green pair CHANGED at the founder's direction, from
     #9CCFB8 / #0A6B51 (teal) to sage #C9D1A9 / olive-dark #4A5530, so "Looks good" reads in the
     olive palette everywhere the band draws. The amber and coral pairs are unchanged. The
     palette assertion in scripts/test-band-nav-centring.mjs moved with these two values. */
~~~~

Now reads:

~~~~
/* DASHBOARD_V2_DESIGN, 2026-10-13: the green pair CHANGED, from
     #9CCFB8 / #0A6B51 (teal) to sage #C9D1A9 / olive-dark #4A5530, so "Looks good" reads in the
     olive palette everywhere the band draws. The amber and coral pairs are unchanged. The
     palette assertion in scripts/test-band-nav-centring.mjs moved with these two values. */
~~~~

### dashboard.html:48 (stripped, css)

~~~~
/* The approved mockup's glass card, and the dashboard's soft shadow (DASHBOARD_V2_DESIGN --v2-shadow).
     .86 rather than the dashboard's .7: these cards sit on plain cream with no colour field behind. */
~~~~

Now reads:

~~~~
/* The mockup's glass card, and the dashboard's soft shadow (DASHBOARD_V2_DESIGN --v2-shadow).
     .86 rather than the dashboard's .7: these cards sit on plain cream with no colour field behind. */
~~~~

### dashboard.html:111 (stripped, css)

~~~~
/* Account overlay (settings) — reuses .del-modal backdrop; card + delete zone per approved mock */
~~~~

Now reads:

~~~~
/* Account overlay (settings) — reuses .del-modal backdrop; card + delete zone per mock */
~~~~

### dashboard.html:136 (stripped, css)

~~~~
/* Two-column dashboard layout: main content + a fixed 350px rail (trends, systems, generate
   button). Layout only. minmax(0,1fr) is required so wide children (sparklines, tables) cannot
   overflow the track. .dash-main{min-width:0} for the same reason. The rail is sticky. Its top
   offset is COMPUTED in JS by syncRailOffset, not set in CSS, because the rail grows with panel
   history and can exceed the viewport. Formula: min(72, innerHeight - railHeight - 16). A short
   rail pins under the topbar at 72. A tall rail gets a negative offset, so it sticks above the
   viewport top and its bottom edge lands 16px above the viewport bottom. That keeps the Generate
   report CTA reachable. NO max-height and NO overflow on the rail, ever. Both were removed in
   687e236 because they hid the CTA behind an invisible fold. Measured 2026-08-04: the rail is
   886px baseline and 956px first-panel, against roughly 812px of viewport at a 900px window.
   Below 960px the rail is position:static and the inline top is ignored. When the main column is
   shorter than the rail (a sparse panel) there is no slack, so nothing pins. That is correct, not
   a bug. */
~~~~

Now reads:

~~~~
/* Two-column dashboard layout: main content + a fixed 350px rail (trends, systems, generate
   button). Layout only. minmax(0,1fr) is required so wide children (sparklines, tables) cannot
   overflow the track. .dash-main{min-width:0} for the same reason. The rail is sticky. Its top
   offset is COMPUTED in JS by syncRailOffset, not set in CSS, because the rail grows with panel
   history and can exceed the viewport. Formula: min(72, innerHeight - railHeight - 16). A short
   rail pins under the topbar at 72. A tall rail gets a negative offset, so it sticks above the
   viewport top and its bottom edge lands 16px above the viewport bottom. That keeps the Generate
   report CTA reachable. NO max-height and NO overflow on the rail, ever. Both were removed
   because they hid the CTA behind an invisible fold. Measured 2026-08-04: the rail is
   886px baseline and 956px first-panel, against roughly 812px of viewport at a 900px window.
   Below 960px the rail is position:static and the inline top is ignored. When the main column is
   shorter than the rail (a sparse panel) there is no slack, so nothing pins. That is correct, not
   a bug. */
~~~~

### dashboard.html:273 (stripped, css)

~~~~
/* ONBOARDING_PALETTE_V1: a full-width option row, so the selected state is sage-pale with an olive
   border and olive-dark text (7.18:1), as in the approved mockup. Was teal-soft and teal. */
~~~~

Now reads:

~~~~
/* ONBOARDING_PALETTE_V1: a full-width option row, so the selected state is sage-pale with an olive
   border and olive-dark text (7.18:1), as in the mockup. Was teal-soft and teal. */
~~~~

### dashboard.html:703 (stripped, css)

~~~~
/* SANA_THREAD_V1 — geometry from mocks/sana-thread.html, the approved spec.
   The thread scrolls inside the card so a long conversation cannot push the
   input off screen; the row sits below it and stays put. */
~~~~

Now reads:

~~~~
/* SANA_THREAD_V1 — geometry from mocks/sana-thread.html, the spec.
   The thread scrolls inside the card so a long conversation cannot push the
   input off screen; the row sits below it and stays put. */
~~~~

### dashboard.html:844 (stripped, css)

~~~~
/* Name owns the space between spark and value; truncates (never wraps) — min 90px legible before the
   ellipsis, matching the rail preview card (004bc8c). A trends row has a value + tag on the line, so
   unlike .fp-name (first-panel rows wrap) it must truncate. */
~~~~

Now reads:

~~~~
/* Name owns the space between spark and value; truncates (never wraps) — min 90px legible before the
   ellipsis, matching the rail preview card. A trends row has a value + tag on the line, so
   unlike .fp-name (first-panel rows wrap) it must truncate. */
~~~~

### dashboard.html:1016 (stripped, css)

~~~~
/* REVEAL_PALETTE_V1, 2026-10-14: the walkthrough moves off teal and Plus Jakarta onto the coral, olive, ink and
   Fraunces system (approved mockup: the "Reading Reveal Redesign" artifact). Every rule stays scoped to
   #view-reveal, which sits OUTSIDE #view-dashboard, so DASHBOARD_V2_DESIGN's teal re-pointing never reached it
   and these values are what renders. The --rv-* names are local to the view, not :root tokens. */
~~~~

Now reads:

~~~~
/* REVEAL_PALETTE_V1, 2026-10-14: the walkthrough moves off teal and Plus Jakarta onto the coral, olive, ink and
   Fraunces system (mockup: the "Reading Reveal Redesign" artifact). Every rule stays scoped to
   #view-reveal, which sits OUTSIDE #view-dashboard, so DASHBOARD_V2_DESIGN's teal re-pointing never reached it
   and these values are what renders. The --rv-* names are local to the view, not :root tokens. */
~~~~

### dashboard.html:1067 (stripped, css)

~~~~
/* REVEAL_CENTRING_V1 — the max-height:760px override is REMOVED, not retargeted, and the history
   is the reason. It was introduced with the original deck in 96ff71b (2026-06-03). Later, b9b1808
   (2026-08-16) replaced justify-content:center with `safe center` to stop an overflowing step
   pushing its first paragraph above the scroll origin, and its commit body says of this rule, in
   as many words: "max-height:760px override left in place as belt-and-suspenders". So it was
   already redundant the day it was kept, by its author's own account.

   IT IS NOT A DUPLICATE OF `safe`, AND THAT DIFFERENCE IS THE BUG. `safe` degrades to
   start-alignment only when the content actually overflows. This rule fired on VIEWPORT HEIGHT,
   so on a 646px-tall window every beat top-aligned, including a two-line one with half the screen
   empty beneath it. That is the reported symptom and `safe center` never produces it.

   RETARGETING IT TO PLAIN `center` WOULD REGRESS b9b1808 exactly where it matters most. A short
   viewport is where a step is most likely to overflow, and plain center on an overflowing flex
   column is the unreachable-top bug that commit exists to fix. Removal is the only option that
   keeps both behaviours.

   THE UNSUPPORTED-BROWSER CASE CANNOT GET WORSE. A UA that does not know the `safe` keyword drops
   the whole declaration as invalid and falls back to the initial value, which lays a flex column
   out from the start edge -- the same top-aligned result this rule was producing. So the
   belt-and-suspenders concern is already answered by how `safe center` fails.

   THE TALL BEAT IS SAFE BY CONSTRUCTION, not by measurement: .card carries overflow-y:auto, and
   `safe` start-aligns precisely when content exceeds the box, so no beat can clip its top at any
   height. Measured for the record, the longest static beat template in buildDeck is the handoff
   beat at 815 characters of visible copy, ahead of the three-tier explainer at 626; the
   data-driven priority beat can exceed both at a high priority count, which is why the guarantee
   is structural rather than a bound on any one beat. */
~~~~

Now reads:

~~~~
/* REVEAL_CENTRING_V1 — the max-height:760px override is REMOVED, not retargeted, and the history
   is the reason. It was introduced with the original deck (2026-06-03). Later, a commit
   (2026-08-16) replaced justify-content:center with `safe center` to stop an overflowing step
   pushing its first paragraph above the scroll origin, and its commit body says of this rule, in
   as many words: "max-height:760px override left in place as belt-and-suspenders". So it was
   already redundant the day it was kept, by its author's own account.

   IT IS NOT A DUPLICATE OF `safe`, AND THAT DIFFERENCE IS THE BUG. `safe` degrades to
   start-alignment only when the content actually overflows. This rule fired on VIEWPORT HEIGHT,
   so on a 646px-tall window every beat top-aligned, including a two-line one with half the screen
   empty beneath it. That is the reported symptom and `safe center` never produces it.

   RETARGETING IT TO PLAIN `center` WOULD REGRESS that commit exactly where it matters most. A short
   viewport is where a step is most likely to overflow, and plain center on an overflowing flex
   column is the unreachable-top bug that commit exists to fix. Removal is the only option that
   keeps both behaviours.

   THE UNSUPPORTED-BROWSER CASE CANNOT GET WORSE. A UA that does not know the `safe` keyword drops
   the whole declaration as invalid and falls back to the initial value, which lays a flex column
   out from the start edge -- the same top-aligned result this rule was producing. So the
   belt-and-suspenders concern is already answered by how `safe center` fails.

   THE TALL BEAT IS SAFE BY CONSTRUCTION, not by measurement: .card carries overflow-y:auto, and
   `safe` start-aligns precisely when content exceeds the box, so no beat can clip its top at any
   height. Measured for the record, the longest static beat template in buildDeck is the handoff
   beat at 815 characters of visible copy, ahead of the three-tier explainer at 626; the
   data-driven priority beat can exceed both at a high priority count, which is why the guarantee
   is structural rather than a bound on any one beat. */
~~~~

### dashboard.html:1177 (stripped, css)

~~~~
/* PRIORITIES_COLLAPSE_V1 — reveal priority cards take the approved mock's treatment: white card,
   left tone stripe, small rank chip, full priority text (no 2-line clamp). Stripe tone stays
   engine-derived through toneFor (TONEFOR_V2); model `severity` is still never read. t-neutral
   takes the quiet brown stripe, NOT the mock's illustrative teal — t-neutral also covers the
   engine-silent marker, and a no-data marker must never read as reassuring (the same rule
   sysStatus applies to no_value). */
~~~~

Now reads:

~~~~
/* PRIORITIES_COLLAPSE_V1 — reveal priority cards take the mock's treatment: white card,
   left tone stripe, small rank chip, full priority text (no 2-line clamp). Stripe tone stays
   engine-derived through toneFor (TONEFOR_V2); model `severity` is still never read. t-neutral
   takes the quiet brown stripe, NOT the mock's illustrative teal — t-neutral also covers the
   engine-silent marker, and a no-data marker must never read as reassuring (the same rule
   sysStatus applies to no_value). */
~~~~

### dashboard.html:1257 (stripped, css)

~~~~
/* Report vault ("Your reports") — approved mock tokens */
~~~~

Now reads:

~~~~
/* Report vault ("Your reports") — mock tokens */
~~~~

### dashboard.html:1454 (stripped, css)

~~~~
/* CYCLE_CARD_V1. Built from mocks/cycle-card.html, with the 2026-10-12 rulings: the module's four
   phase labels only (no ovulation state), the module's own lines, site amber. Two hosts, one
   render: the rail host above 960px, the main-column host (after Sana) at 960px and below.
   SUPERSEDED BY DASHBOARD_V2_DESIGN, 2026-10-13. The v2 dashboard is ONE column at every width, so
   the card sits immediately after Sana everywhere and the desktop rail placement is retired. The
   two hosts and the one render are unchanged: the rail host is simply never displayed, and the
   main host is displayed whenever cyPaint has filled it. Same two rules at every width now, where
   they used to apply only at 960px and below. */
~~~~

Now reads:

~~~~
/* CYCLE_CARD_V1. Built from mocks/cycle-card.html: the module's four
   phase labels only (no ovulation state), the module's own lines, site amber. Two hosts, one
   render: the rail host above 960px, the main-column host (after Sana) at 960px and below.
   SUPERSEDED BY DASHBOARD_V2_DESIGN, 2026-10-13. The v2 dashboard is ONE column at every width, so
   the card sits immediately after Sana everywhere and the desktop rail placement is retired. The
   two hosts and the one render are unchanged: the rail host is simply never displayed, and the
   main host is displayed whenever cyPaint has filled it. Same two rules at every width now, where
   they used to apply only at 960px and below. */
~~~~

### dashboard.html:1770 (stripped, css)

~~~~
/* ONBOARDING_V2 — site tokens only. Mirrors .onb-card geometry and the teal
   primary so the flow reads as the same product as the upload card and the age
   modal. No new palette.

   MOTION ported verbatim from docs/onboarding-motion-approved-v6.html
   (founder-approved 2026-09-03, md5 efa88aed...). Durations, easings, offsets
   and the 56px gap are the spec's numbers, not retuned. The one sanctioned
   deviation is the orb mark, which uses the site's #bw-mark symbol. */
~~~~

Now reads:

~~~~
/* ONBOARDING_V2 — site tokens only. Mirrors .onb-card geometry and the teal
   primary so the flow reads as the same product as the upload card and the age
   modal. No new palette.

   MOTION ported verbatim from `docs/onboarding-motion-approved-v6.html`.
   Durations, easings, offsets
   and the 56px gap are the spec's numbers, not retuned. The one sanctioned
   deviation is the orb mark, which uses the site's #bw-mark symbol. */
~~~~

### dashboard.html:1833 (stripped, css)

~~~~
/* ONBOARDING_PALETTE_V1: the approved mockup sets the note on a sage-pale wash, olive-dark text 7.18:1. */
~~~~

Now reads:

~~~~
/* ONBOARDING_PALETTE_V1: the mockup sets the note on a sage-pale wash, olive-dark text 7.18:1. */
~~~~

### dashboard.html:1924 (stripped, css)

~~~~
/* ─────────────────────────────────────────────────────────────────────────────────────────────
   DASHBOARD_V2_DESIGN, 2026-10-13. The approved "Sana-centred" v2 dashboard, in the marketing
   site's olive and coral palette.

   WHAT THIS BLOCK IS. Presentation only. Every rule is scoped to #view-dashboard, or to the top
   bar while #view-dashboard is the visible view, so the upload, processing, reveal, companion and
   overlay views render exactly as before. It sits LAST in the stylesheet and leads with the id, so
   it wins over the rules above without editing them; those rules stay as the record of what the
   page looked like and why, and they still style every other view.

   THE PALETTE SWAP IS DONE BY RE-POINTING TOKENS, not by rewriting rules. Inside the view, every
   teal-role token resolves to its olive or sage counterpart (text and marks to --olive, fills to
   --sage, tints to --sage-soft and --sage-pale), so the ~170 existing var(--teal...) references
   inside the dashboard turn olive with no edit, and the same references in other views stay teal.
   The names are left as they are on purpose for now: renaming them is a whole-file change across
   views this commit does not touch. Hard-coded teal and dark-hero values that a token cannot
   reach (inline colours written by renderers, rgba() literals) are overridden one by one below,
   and the PR's computed-colour sweep is the check that none was missed.

   STATUS COLOURS. "Looks good" is sage, "Worth watching" stays amber, "Worth a closer look" is
   coral. Fills use the base tones; any text in a status colour uses the darker ink of that tone so
   it clears 4.5:1 (coral text is #8E5340, never --coral).

   MOTION. Fade-up, the band draw-in and the orb's breathing all live inside
   @media(prefers-reduced-motion:no-preference), so with reduced motion on nothing moves.
   ───────────────────────────────────────────────────────────────────────────────────────────── */
~~~~

Now reads:

~~~~
/* ─────────────────────────────────────────────────────────────────────────────────────────────
   DASHBOARD_V2_DESIGN, 2026-10-13. The "Sana-centred" v2 dashboard, in the marketing
   site's olive and coral palette.

   WHAT THIS BLOCK IS. Presentation only. Every rule is scoped to #view-dashboard, or to the top
   bar while #view-dashboard is the visible view, so the upload, processing, reveal, companion and
   overlay views render exactly as before. It sits LAST in the stylesheet and leads with the id, so
   it wins over the rules above without editing them; those rules stay as the record of what the
   page looked like and why, and they still style every other view.

   THE PALETTE SWAP IS DONE BY RE-POINTING TOKENS, not by rewriting rules. Inside the view, every
   teal-role token resolves to its olive or sage counterpart (text and marks to --olive, fills to
   --sage, tints to --sage-soft and --sage-pale), so the ~170 existing var(--teal...) references
   inside the dashboard turn olive with no edit, and the same references in other views stay teal.
   The names are left as they are on purpose for now: renaming them is a whole-file change across
   views this commit does not touch. Hard-coded teal and dark-hero values that a token cannot
   reach (inline colours written by renderers, rgba() literals) are overridden one by one below,
   and the PR's computed-colour sweep is the check that none was missed.

   STATUS COLOURS. "Looks good" is sage, "Worth watching" stays amber, "Worth a closer look" is
   coral. Fills use the base tones; any text in a status colour uses the darker ink of that tone so
   it clears 4.5:1 (coral text is #8E5340, never --coral).

   MOTION. Fade-up, the band draw-in and the orb's breathing all live inside
   @media(prefers-reduced-motion:no-preference), so with reduced motion on nothing moves.
   ───────────────────────────────────────────────────────────────────────────────────────────── */
~~~~

### dashboard.html:2006 (stripped, css)

~~~~
/* Section labels: the ruled copy is unchanged, only its dress. */
~~~~

Now reads:

~~~~
/* Section labels: the copy is unchanged, only its dress. */
~~~~

### dashboard.html:2104 (stripped, css)

~~~~
/* SANA_ONLINE_REMOVE_V1: the .comp-online and .comp-online-dot rules went with the Online pill, removed at the founder's request on 2026-10-15. */
~~~~

Now reads:

~~~~
/* SANA_ONLINE_REMOVE_V1: the .comp-online and .comp-online-dot rules went with the Online pill. */
~~~~

### dashboard.html:2342 (stripped, css)

~~~~
/* ── LIST_VIEWS_PALETTE_V1, 2026-10-14 ───────────────────────────────────────────────────────────
   The all-markers, trends, gaps, themes and systems pages and the system modal, onto the coral,
   olive, ink and Fraunces system (approved mockup: the "Markers and Trends Redesign" artifact).

   WHY EVERY RULE HERE NAMES ONE OF THE SIX CONTAINERS. All six live INSIDE #view-dashboard, so
   DASHBOARD_V2_DESIGN already reaches them: it re-points --teal to olive and sets
   "#view-dashboard *{font-family:var(--sans)}". That rule is specificity (1,0,0), which beats any
   bare class, so a heading set in Fraunces by a .class rule alone would never show. Naming the
   container gives (1,1,0) and up, and sitting after the DASHBOARD_V2 block settles the ties.
   It also keeps the dashboard rail untouched: nothing below can match outside these containers.

   NOT HERE, deliberately. .mk-band* is already restyled by DASHBOARD_V2 inside the modal too, and
   carries no teal. The rail's .longi-card*, .longi-p*, .longi-viewall, .gap-card and .sysr-* are
   the dashboard's own and are out of scope. The trend chart has no in-range zone to shade: adding
   one is render logic, which this change does not touch.
   ──────────────────────────────────────────────────────────────────────────────────────────── */
~~~~

Now reads:

~~~~
/* ── LIST_VIEWS_PALETTE_V1, 2026-10-14 ───────────────────────────────────────────────────────────
   The all-markers, trends, gaps, themes and systems pages and the system modal, onto the coral,
   olive, ink and Fraunces system (mockup: the "Markers and Trends Redesign" artifact).

   WHY EVERY RULE HERE NAMES ONE OF THE SIX CONTAINERS. All six live INSIDE #view-dashboard, so
   DASHBOARD_V2_DESIGN already reaches them: it re-points --teal to olive and sets
   "#view-dashboard *{font-family:var(--sans)}". That rule is specificity (1,0,0), which beats any
   bare class, so a heading set in Fraunces by a .class rule alone would never show. Naming the
   container gives (1,1,0) and up, and sitting after the DASHBOARD_V2 block settles the ties.
   It also keeps the dashboard rail untouched: nothing below can match outside these containers.

   NOT HERE, deliberately. .mk-band* is already restyled by DASHBOARD_V2 inside the modal too, and
   carries no teal. The rail's .longi-card*, .longi-p*, .longi-viewall, .gap-card and .sysr-* are
   the dashboard's own and are out of scope. The trend chart has no in-range zone to shade: adding
   one is render logic, which this change does not touch.
   ──────────────────────────────────────────────────────────────────────────────────────────── */
~~~~

### dashboard.html:3683 (stripped, js-line)

~~~~
// ── TESTER_GATE_V1 ─────────────────────────────────────────────────────────────────────
// The external tester agreement gate. Counsel's condition is that no external tester
// receives access until they have agreed to the approved text and the acceptance is
// recorded, so this is a LAUNCH CONDITION and not a product flow.
//
// INDEPENDENT OF ONBOARDING_ENABLED, deliberately, exactly like DOB_GATE_V1. Onboarding
// is a feature behind a flag that happens to be off; this is a gate that must hold
// whatever else is switched on. Flipping ONBOARDING_ENABLED must never move it.
//
// The agreement version and hash below MUST match the server registry in
// supabase/functions/process-report-worker/tester-agreements.ts. tester-accept refuses a
// mismatch with 409 rather than recording something the tester was not shown, so a drift
// here fails loudly at the point of acceptance instead of silently storing the wrong sha.
// ON as of 2026-09-07. Safe to flip now, and the reason is that there is nobody to
// surprise: there are NO external users. Every account on the project is a founder test
// account, `p27` (`1e6eb2cc`) is the proof fixture, and migrations 0048 and 0049 are
// applied and read back, so the acceptance table exists with exactly one grant on it.
// Flipping this before the table existed would have put every sign in behind a gate that
// could not be passed, which is why it shipped false and waited.
~~~~

Now reads:

~~~~
// ── TESTER_GATE_V1 ─────────────────────────────────────────────────────────────────────
// The external tester agreement gate. No external tester
// receives access until they have agreed to the text and the acceptance is
// recorded, so this is a LAUNCH CONDITION and not a product flow.
//
// INDEPENDENT OF ONBOARDING_ENABLED, deliberately, exactly like DOB_GATE_V1. Onboarding
// is a feature behind a flag that happens to be off; this is a gate that must hold
// whatever else is switched on. Flipping ONBOARDING_ENABLED must never move it.
//
// The agreement version and hash below MUST match the server registry in
// supabase/functions/process-report-worker/tester-agreements.ts. tester-accept refuses a
// mismatch with 409 rather than recording something the tester was not shown, so a drift
// here fails loudly at the point of acceptance instead of silently storing the wrong sha.
// ON as of 2026-09-07. Safe to flip now, and the reason is that there is nobody to
// surprise: there are NO external users. Every account on the project is a test
// account, `p27` is the proof fixture, and migrations 0048 and 0049 are
// applied and read back, so the acceptance table exists with exactly one grant on it.
// Flipping this before the table existed would have put every sign in behind a gate that
// could not be passed, which is why it shipped false and waited.
~~~~

### dashboard.html:3703 (stripped, js-line)

~~~~
// AGREEMENT_V12. The version a NEW participant is shown, and the versions an EXISTING
// acceptance may stand against. Counsel ruled 2026-09-07 that v1.2 does not replace v1.1
// for anyone who already accepted it, so a v1.1 row passes this gate and its holder is
// never asked again. Both lists must match the server registry in
// supabase/functions/process-report-worker/tester-agreements.ts.
~~~~

Now reads:

~~~~
// AGREEMENT_V12. The version a NEW participant is shown, and the versions an EXISTING
// acceptance may stand against. v1.2 does not replace v1.1
// for anyone who already accepted it, so a v1.1 row passes this gate and its holder is
// never asked again. Both lists must match the server registry in
// supabase/functions/process-report-worker/tester-agreements.ts.
~~~~

### dashboard.html:3915 (stripped, js-line)

~~~~
// Rail sticky offset. The rail varies in height with the user's panel
// history, so the offset is computed, not fixed. When the rail is
// shorter than the viewport this resolves to 72 and behaves as normal
// top-sticky under the topbar. When it is taller it goes negative, so
// the rail sticks above the viewport top and its BOTTOM edge lands
// 16px above the viewport bottom. That is what keeps the Generate
// report CTA reachable. Never add max-height or overflow to the rail.
// That was removed in 687e236 and it hid the CTA behind an invisible
// fold. See the .dash-grid comment.
~~~~

Now reads:

~~~~
// Rail sticky offset. The rail varies in height with the user's panel
// history, so the offset is computed, not fixed. When the rail is
// shorter than the viewport this resolves to 72 and behaves as normal
// top-sticky under the topbar. When it is taller it goes negative, so
// the rail sticks above the viewport top and its BOTTOM edge lands
// 16px above the viewport bottom. That is what keeps the Generate
// report CTA reachable. Never add max-height or overflow to the rail.
// That was removed and it hid the CTA behind an invisible
// fold. See the .dash-grid comment.
~~~~

### dashboard.html:4059 (stripped, js-line)

~~~~
// REPLAY_CONSENT_V1 - async DELIBERATELY. The handler must resolve the face-scan consent before
// building, and buildDeck is not allowed to resolve it itself. Converting an onclick is safe here
// and was checked rather than assumed: nothing reads this handler's return value (0 sites) and
// nothing invokes it programmatically (0 .click() or dispatchEvent on btn-replay, against 2
// .click() calls elsewhere in the file as a control).
//
// THE AWAIT OPENS A GAP, and both things that fall into it are handled.
// DOUBLE CLICK: on a warm cache sanaConsentGranted returns from SANA_CONSENT_STATE and the gap is
// a microtask; on a cold one it is a network call. Without replayBuilding a second click inside
// that window builds the deck twice. The flag is released in a finally so a failed build cannot
// wedge the button shut.
// A THROW MUST NOT SILENTLY DO NOTHING: an async onclick that rejects yields an unhandled
// rejection and the button reads as dead. Ruled: a throw is NOT consented, the deck still builds,
// item 6 is omitted, and showView('reveal') still runs. She clicks replay, she gets her deck.
// Today's sanaConsentGranted catches internally and cannot reject, so this catch guards a future
// change to it rather than a live path; the suite proves it with an injected rejecting stub.
~~~~

Now reads:

~~~~
// REPLAY_CONSENT_V1 - async DELIBERATELY. The handler must resolve the face-scan consent before
// building, and buildDeck is not allowed to resolve it itself. Converting an onclick is safe here
// and was checked rather than assumed: nothing reads this handler's return value (0 sites) and
// nothing invokes it programmatically (0 .click() or dispatchEvent on btn-replay, against 2
// .click() calls elsewhere in the file as a control).
//
// THE AWAIT OPENS A GAP, and both things that fall into it are handled.
// DOUBLE CLICK: on a warm cache sanaConsentGranted returns from SANA_CONSENT_STATE and the gap is
// a microtask; on a cold one it is a network call. Without replayBuilding a second click inside
// that window builds the deck twice. The flag is released in a finally so a failed build cannot
// wedge the button shut.
// A THROW MUST NOT SILENTLY DO NOTHING: an async onclick that rejects yields an unhandled
// rejection and the button reads as dead. A throw is NOT consented, the deck still builds,
// item 6 is omitted, and showView('reveal') still runs. She clicks replay, she gets her deck.
// Today's sanaConsentGranted catches internally and cannot reject, so this catch guards a future
// change to it rather than a live path; the suite proves it with an injected rejecting stub.
~~~~

### dashboard.html:4100 (stripped, js-line)

~~~~
// Consent gate (Stage 3): the dropzone stays locked until the box is checked, or the profile
// is already consented. handleFile also records consent as its first step, so this is the UX
// half of a server-enforced gate, not the gate itself.
// ── DOB_GATE_V1 ────────────────────────────────────────────────────────────────────────────
// The pre-upload date of birth prompt. Counsel's launch condition 5 is that the under-18
// upload refusal stays enabled as designed; this is the CLIENT half of it. The server half is
// migration 0044's two RESTRICTIVE policies, which refuse the insert outright. Neither is
// sufficient alone: this one is a courtesy that explains the refusal, that one is the control.
//
// INDEPENDENT OF ONBOARDING_ENABLED, deliberately. Onboarding is a product flow behind a flag
// that is off; the age condition is a launch condition. Until this shipped, the single writer of
// profiles.dob sat inside onb2, so a new account was never asked and dob stayed null forever.
//
// dob PRESENT means this never renders. Not "renders and skips" -- returns before touching the
// DOM, so a user who already answered cannot be asked twice.
~~~~

Now reads:

~~~~
// Consent gate (Stage 3): the dropzone stays locked until the box is checked, or the profile
// is already consented. handleFile also records consent as its first step, so this is the UX
// half of a server-enforced gate, not the gate itself.
// ── DOB_GATE_V1 ────────────────────────────────────────────────────────────────────────────
// The pre-upload date of birth prompt. The under-18
// upload refusal stays enabled as designed; this is the CLIENT half of it. The server half is
// migration 0044's two RESTRICTIVE policies, which refuse the insert outright. Neither is
// sufficient alone: this one is a courtesy that explains the refusal, that one is the control.
//
// INDEPENDENT OF ONBOARDING_ENABLED, deliberately. Onboarding is a product flow behind a flag
// that is off; the age condition is a launch condition. Until this shipped, the single writer of
// profiles.dob sat inside onb2, so a new account was never asked and dob stayed null forever.
//
// dob PRESENT means this never renders. Not "renders and skips" -- returns before touching the
// DOM, so a user who already answered cannot be asked twice.
~~~~

### dashboard.html:4216 (stripped, js-line)

~~~~
// CONSENT_V2_V4_DARK — core consent v2, built DARK. While CORE_CONSENT_V2_ENABLED is false the
// checkbox markup above is untouched and core consent is recorded as v1, exactly as before.
//
// CORE_CONSENT_V2_TEXT is the server's core v2 notice VERBATIM (supa consent-versions.ts, sha256
// 069c1bfe69b4fb01cb84b8d82db6f4c719ef6d353efdf584d4537a5ec55e67cd). consent-accept stores the
// sha256 of ITS copy, so a one-character drift here would certify words she never read. When the
// flag is on, applyCoreConsentText rebuilds the checkbox label from it with the privacy link kept
// as today, so the label's rendered text equals the server's string exactly.
//
// Declared HERE, above the checkbox binding that runs at load, because a const read before its
// declaration line throws. The server still refuses a v2 grant until counsel approves it
// (approved:false), so flipping only this flag would make every tick fail, not stamp.
// SWITCHED ON 2026-09-24, controls.md flip step 3, after counsel's reply C approved core v2 and the
// server began accepting it (consent-accept v9, verified live). The paragraph above describes the
// dark build and is kept as its record.
~~~~

Now reads:

~~~~
// CONSENT_V2_V4_DARK — core consent v2, built DARK. While CORE_CONSENT_V2_ENABLED is false the
// checkbox markup above is untouched and core consent is recorded as v1, exactly as before.
//
// CORE_CONSENT_V2_TEXT is the server's core v2 notice VERBATIM (supa consent-versions.ts, sha256
// 069c1bfe69b4fb01cb84b8d82db6f4c719ef6d353efdf584d4537a5ec55e67cd). consent-accept stores the
// sha256 of ITS copy, so a one-character drift here would certify words she never read. When the
// flag is on, applyCoreConsentText rebuilds the checkbox label from it with the privacy link kept
// as today, so the label's rendered text equals the server's string exactly.
//
// Declared HERE, above the checkbox binding that runs at load, because a const read before its
// declaration line throws. The server still refuses a v2 grant
// (`approved:false`), so flipping only this flag would make every tick fail, not stamp.
// SWITCHED ON 2026-09-24, controls.md flip step 3, after the
// server began accepting it (consent-accept v9, verified live). The paragraph above describes the
// dark build and is kept as its record.
~~~~

### dashboard.html:4795 (stripped, js-block)

~~~~
/**
 * The ONE place core consent is recorded. Throws on refusal; sets CONSENTED only on success.
 *
 * CORE_CONSENT_V3_ROUTE. Sending consent_type selects consent-accept's v3 path, which writes an
 * APPEND-ONLY row to consent_events carrying notice_sha256 of the exact text she agreed to, and
 * THEN mirrors profiles.consent_accepted_at for core, which is what the four-layer upload gate
 * reads. Without consent_type the call takes the legacy path, which updates that mutable column
 * and records nothing else. The version is unchanged: core v1 is the approved notice and its text
 * is byte-identical to the checkbox above, so no wording moves and nothing goes to counsel.
 *
 * A repeat grant of the same version is a no-op server side (stampPlanV3 -> noop_same_version,
 * no insert, no re-stamp), but both callers still guard on CONSENTED so it is not relied on.
 */
~~~~

Now reads:

~~~~
/**
 * The ONE place core consent is recorded. Throws on refusal; sets CONSENTED only on success.
 *
 * CORE_CONSENT_V3_ROUTE. Sending consent_type selects consent-accept's v3 path, which writes an
 * APPEND-ONLY row to consent_events carrying notice_sha256 of the exact text she agreed to, and
 * THEN mirrors profiles.consent_accepted_at for core, which is what the four-layer upload gate
 * reads. Without consent_type the call takes the legacy path, which updates that mutable column
 * and records nothing else. The version is unchanged: core v1 is the notice and its text
 * is byte-identical to the checkbox above, so no wording moves.
 *
 * A repeat grant of the same version is a no-op server side (stampPlanV3 -> noop_same_version,
 * no insert, no re-stamp), but both callers still guard on CONSENTED so it is not relied on.
 */
~~~~

### dashboard.html:4967 (stripped, js-line)

~~~~
// ── PROCESSING_COPY_V1 ──────────────────────────────────────────────────────────────────────
// Honest processing copy. Three states, all byte-matching the re-signed artifact
// docs/biowellth-between-calls-copy-SIGNED.md (founder-signed, 2026-08-18):
//   IN-3  normal interim, under the threshold
//   IN-4  long-running continuation, past it. This ALSO covers a queue retry: a retry is NOT
//         front-end distinguishable, because failPhase writes reports.status='error' only when
//         attempts are exhausted, so attempts 2 and 3 look identical to attempt 1. That is correct,
//         a retry is the queue working, not a fault she needs told.
//   FAIL  terminal failure, reports.status='error'. Zero motion, zero reading-language.
// Elapsed is measured from reports.created_at, which is the true time since upload and works
// identically in-session and on a revisit. __pcPollStart is only a fallback when created_at is
// missing.
//
// PROCESSING_COPY_V2 (2026-08-20): threshold raised 6 -> 9 minutes, because at 6 it had started
// firing on HEALTHY runs. Measured end to end on flow11, post CALL_B_OUTPUT_TRIM_V1, clean single
// attempt: upload -> transcription enqueued 5.8s, cron claim 26.8s, Call A 97s (numbers visible at
// 2.2 min), interpretation cron claim 35s, Call B 241s. Total to reveal 6.8 MINUTES — past the old
// 6 minute threshold, so a normal successful reading spent its last ~48 seconds showing IN-4.
//
// IN-4 is the "this is taking a while" state ("sometimes ten minutes or more"). Showing it on a run
// that is about to succeed is a small dishonesty in the same family as the retired "almost ready"
// string: it tells her something is unusual when nothing is. 9 minutes puts it clear of the measured
// typical while still landing well before the retry cases, which is what IN-4 exists for.
//
// The superseded comment claimed "the typical full reading lands around 5 minutes". That was true
// pre-trim-era tuning and is no longer; it is corrected rather than deleted so the change is legible.
// NOTE: no ceiling number belongs in the copy itself. The retry paths are modelled, not measured end
// to end (failPhase ~14.5 min, reaper path ~20.5 min), so IN-4's existing hedge is the honest form.
~~~~

Now reads:

~~~~
// ── PROCESSING_COPY_V1 ──────────────────────────────────────────────────────────────────────
// Honest processing copy. Three states, all byte-matching the re-signed artifact
// docs/biowellth-between-calls-copy-SIGNED.md:
//   IN-3  normal interim, under the threshold
//   IN-4  long-running continuation, past it. This ALSO covers a queue retry: a retry is NOT
//         front-end distinguishable, because failPhase writes reports.status='error' only when
//         attempts are exhausted, so attempts 2 and 3 look identical to attempt 1. That is correct,
//         a retry is the queue working, not a fault she needs told.
//   FAIL  terminal failure, reports.status='error'. Zero motion, zero reading-language.
// Elapsed is measured from reports.created_at, which is the true time since upload and works
// identically in-session and on a revisit. __pcPollStart is only a fallback when created_at is
// missing.
//
// PROCESSING_COPY_V2 (2026-08-20): threshold raised 6 -> 9 minutes, because at 6 it had started
// firing on HEALTHY runs. Measured end to end on flow11, post CALL_B_OUTPUT_TRIM_V1, clean single
// attempt: upload -> transcription enqueued 5.8s, cron claim 26.8s, Call A 97s (numbers visible at
// 2.2 min), interpretation cron claim 35s, Call B 241s. Total to reveal 6.8 MINUTES — past the old
// 6 minute threshold, so a normal successful reading spent its last ~48 seconds showing IN-4.
//
// IN-4 is the "this is taking a while" state ("sometimes ten minutes or more"). Showing it on a run
// that is about to succeed is a small dishonesty in the same family as the retired "almost ready"
// string: it tells her something is unusual when nothing is. 9 minutes puts it clear of the measured
// typical while still landing well before the retry cases, which is what IN-4 exists for.
//
// The superseded comment claimed "the typical full reading lands around 5 minutes". That was true
// pre-trim-era tuning and is no longer; it is corrected rather than deleted so the change is legible.
// NOTE: no ceiling number belongs in the copy itself. The retry paths are modelled, not measured end
// to end (failPhase ~14.5 min, reaper path ~20.5 min), so IN-4's existing hedge is the honest form.
~~~~

### dashboard.html:5018 (stripped, js-line)

~~~~
// FAIL-2 / FAIL-5, byte-exact from the artifact (re-signed by the founder 2026-08-19). FAIL-5 is the
// SECOND-failure state: the one retry is spent, so no control is offered that would be refused.
~~~~

Now reads:

~~~~
// FAIL-2 / FAIL-5, byte-exact from the artifact. FAIL-5 is the
// SECOND-failure state: the one retry is spent, so no control is offered that would be refused.
~~~~

### dashboard.html:5022 (stripped, js-line)

~~~~
// FAIL6_V1 — FAIL-6, byte-exact from the artifact (signed by the founder 2026-08-19). UNRETRYABLE: the
// report failed before or during transcription, so there is nothing to re-read and RETRY_MODE_V1 can
// never rescue it. Distinct from FAIL-2 (retry available) and FAIL-5 (retry spent) because BOTH of
// those strings are false here — FAIL-2 promises a retry the backend refuses, FAIL-5 claims we tried
// when we never did. The body states WHY there is no retry control, so its absence reads as honesty.
~~~~

Now reads:

~~~~
// FAIL6_V1 — FAIL-6, byte-exact from the artifact. UNRETRYABLE: the
// report failed before or during transcription, so there is nothing to re-read and RETRY_MODE_V1 can
// never rescue it. Distinct from FAIL-2 (retry available) and FAIL-5 (retry spent) because BOTH of
// those strings are false here — FAIL-2 promises a retry the backend refuses, FAIL-5 claims we tried
// when we never did. The body states WHY there is no retry control, so its absence reads as honesty.
~~~~

### dashboard.html:5251 (stripped, js-line)

~~~~
// STALE_TAB_POLL_V1 — the report this poll is watching, or null when nothing is in flight.
// Needed because a backgrounded tab does not lose its interval, it gets THROTTLED (browsers clamp
// background timers to roughly once a minute). The founder's 2026-08-19 walk finished at 22:58 and the tab
// still showed "processing" minutes later: the backend was healthy the whole time and the payload was
// readable to her, the tab just had not ticked. So the fix is not a faster interval, it is an
// immediate tick the moment the tab is looked at again.
~~~~

Now reads:

~~~~
// STALE_TAB_POLL_V1 — the report this poll is watching, or null when nothing is in flight.
// Needed because a backgrounded tab does not lose its interval, it gets THROTTLED (browsers clamp
// background timers to roughly once a minute). The 2026-08-19 walk finished at 22:58 and the tab
// still showed "processing" minutes later: the backend was healthy the whole time and the payload was
// readable to her, the tab just had not ticked. So the fix is not a faster interval, it is an
// immediate tick the moment the tab is looked at again.
~~~~

### dashboard.html:5390 (stripped, js-line)

~~~~
// REVIEW_GATE_COPY_V2 (2026-09-25, founder copy). PFU_SAVED_B was "Our team checks every report
// before you see it during early access.", the pending view's first sentence verbatim. It is now its
// own shorter line and no longer a substring of the pending body; both still make the same promise.
~~~~

Now reads:

~~~~
// REVIEW_GATE_COPY_V2 (2026-09-25). PFU_SAVED_B was "Our team checks every report
// before you see it during early access.", the pending view's first sentence verbatim. It is now its
// own shorter line and no longer a substring of the pending body; both still make the same promise.
~~~~

### dashboard.html:5490 (stripped, js-line)

~~~~
// The interim 193/20 screen is a PURE CONFIDENCE BEAT (the confounder ask moved to the Call A
  // "Reading your report" screen, 2026-07-15). IN-3 (SIGNED docs/biowellth-between-calls-copy-SIGNED.md)
  // is the calm reassurance; no ask here. Top matter -> #interim-list, marker list -> #interim-markers.
  // PROCESSING_COPY_V1: IN-3 / IN-4 are chosen by ELAPSED, see pcInterimSub. Both byte-match the
  // re-signed artifact (docs/biowellth-between-calls-copy-SIGNED.md, founder-signed 2026-08-18).
~~~~

Now reads:

~~~~
// The interim 193/20 screen is a PURE CONFIDENCE BEAT (the confounder ask moved to the Call A
  // "Reading your report" screen, 2026-07-15). IN-3 (SIGNED docs/biowellth-between-calls-copy-SIGNED.md)
  // is the calm reassurance; no ask here. Top matter -> #interim-list, marker list -> #interim-markers.
  // PROCESSING_COPY_V1: IN-3 / IN-4 are chosen by ELAPSED, see pcInterimSub. Both byte-match the
  // re-signed artifact (docs/biowellth-between-calls-copy-SIGNED.md).
~~~~

### dashboard.html:6053 (stripped, js-line)

~~~~
// Companion-register copy (no colons, no em dashes; warm, plain, hedged). The founder may tune.
~~~~

Now reads:

~~~~
// Companion-register copy (no colons, no em dashes; warm, plain, hedged).
~~~~

### dashboard.html:6072 (stripped, js-line)

~~~~
// Folate redirect (Finding #2 step 3): the "folate" word in a B12 ack becomes a tappable link
// that opens the vitamins system modal and reveals the folate row. Constant span injected AFTER
// esc() so the rest of the copy stays escaped (Approach B — the founder's strings stay verbatim).
~~~~

Now reads:

~~~~
// Folate redirect (Finding #2 step 3): the "folate" word in a B12 ack becomes a tappable link
// that opens the vitamins system modal and reveals the folate row. Constant span injected AFTER
// esc() so the rest of the copy stays escaped (Approach B — the strings stay verbatim).
~~~~

### dashboard.html:6134 (stripped, js-line)

~~~~
// Coverage line under the band (2026-07-13). Plain words, no ring change. COPY: completeness, not
// score. Derives "N of your 7 areas" from the pills. Defensive: a LEGACY payload (pre-v51, no
// deferred_reasons + pills lack refusal_reason) renders NOTHING rather than a wrong count — Lakshmi's
// stored payload is stale and hits this. Trailing clause branches on THREE states (retest conversion,
// ratified 2026-07-13): (1) fasting_unknown + chip never answered (key ABSENT) -> "... is waiting on
// one answer" (the chip is showing). (2) fasting_unknown + key PRESENT (answered "Not sure", null, no
// rescore so the reason persists) -> the retest line. (3) not_fasting (answered "No", rescore
// re-emitted the reason) -> the retest line too. The retest line names what becomes READABLE, never a
// score (standing product rule). Held-area naming is unchanged; only the trailing clause differs.
// Sparse-reveal (SIGNED 2026-07-13, docs/biowellth-sparse-reveal-copy-SIGNED.md). Engine-suppressed
// too-thin panel. Gate on the ENGINE verdict (display.show_composite===false AND mode==="pills_only")
// — the SAME condition the backend gates on (worker v61), NEVER composite==null (pregnancy also nulls
// it) or prose. Legacy pre-v51 payloads lack this display shape so they never enter this branch.
~~~~

Now reads:

~~~~
// Coverage line under the band (2026-07-13). Plain words, no ring change. COPY: completeness, not
// score. Derives "N of your 7 areas" from the pills. Defensive: a LEGACY payload (pre-v51, no
// deferred_reasons + pills lack refusal_reason) renders NOTHING rather than a wrong count.
// Trailing clause branches on THREE states (retest conversion):
// (1) fasting_unknown + chip never answered (key ABSENT) -> "... is waiting on
// one answer" (the chip is showing). (2) fasting_unknown + key PRESENT (answered "Not sure", null, no
// rescore so the reason persists) -> the retest line. (3) not_fasting (answered "No", rescore
// re-emitted the reason) -> the retest line too. The retest line names what becomes READABLE, never a
// score (standing product rule). Held-area naming is unchanged; only the trailing clause differs.
// Sparse-reveal (docs/biowellth-sparse-reveal-copy-SIGNED.md). Engine-suppressed
// too-thin panel. Gate on the ENGINE verdict (display.show_composite===false AND mode==="pills_only")
// — the SAME condition the backend gates on (worker v61), NEVER composite==null (pregnancy also nulls
// it) or prose. Legacy pre-v51 payloads lack this display shape so they never enter this branch.
~~~~

### dashboard.html:6215 (stripped, js-line)

~~~~
// no ruled reason -> say nothing rather than guess
~~~~

Now reads:

~~~~
// no reason -> say nothing rather than guess
~~~~

### dashboard.html:6230 (stripped, js-line)

~~~~
// ASKER #3, CONDITIONAL 2026-09-02. The onboarding flow's diet screen asks the
  // same B12 and folate question and writes the same two columns. This chip
  // survives only for a profile that has neither answer, so a user who answered
  // in onboarding is never asked twice. Both null is the only state where this
  // is the single asker; if either is set, onboarding already asked.
~~~~

Now reads:

~~~~
// ASKER #3, CONDITIONAL. The onboarding flow's diet screen asks the
  // same B12 and folate question and writes the same two columns. This chip
  // survives only for a profile that has neither answer, so a user who answered
  // in onboarding is never asked twice. Both null is the only state where this
  // is the single asker; if either is set, onboarding already asked.
~~~~

### dashboard.html:6303 (stripped, js-line)

~~~~
// REVIEW_GATE_V1 (supa docs/review-gate-phase2-spec.md, Step 6). The shared tail of both chip taps.
// enqueue-rescore answers review_gate:true when the rescore of this RELEASED report will be HELD for
// review (the worker stages it and leaves results untouched). Polling for a change that will not come
// would end in a silent 20-second timeout, so instead she is told the update is being prepared, beside
// her answer, and keeps seeing the approved reading. Without the flag (the gate off, or the read
// failed) this is exactly the poll-and-re-render both taps ran before.
~~~~

Now reads:

~~~~
// REVIEW_GATE_V1 (supa docs/review-gate-phase2-spec.md, Step 6). The shared tail of both chip taps.
// enqueue-rescore answers review_gate:true when the rescore of this RELEASED report will be HELD for
// review (the worker stages it and leaves results untouched). Polling for a change that will not come
// would end in a silent 20-second timeout, so instead she is told the update is being prepared, beside
// her answer, and keeps seeing the released reading. Without the flag (the gate off, or the read
// failed) this is exactly the poll-and-re-render both taps ran before.
~~~~

### dashboard.html:6510 (stripped, js-line)

~~~~
// ══════════════════════════════════════════════════════════════════════════
// REPORT GENERATOR v1a — in-app health report + provider-ready PDF.
// RENDER-ONLY off results.payload (window.__rdPayload): no model call, no
// scoring, no ranges, no status re-derivation. Reuses esc / sysStatus /
// isSuppressed / longiOverview / longiMove / markerName / gapName / gapSysName /
// dropSuppressedQW / fmtPanelDate / firstName and the GAP_* suppression sets.
// Sections: S1 Snapshot, S2 Longitudinal, S5 Provider points, S6 Monitoring.
// S3 (risk clusters) and S4 (future outlook) are DEFERRED to v1b — the only
// cluster data in the payload (cluster_patterns) is Call B synthesis, not
// engine/system-detected, so v1a omits it per the build brief.
// ══════════════════════════════════════════════════════════════════════════
// TWO SHAPES LIVE IN THIS TABLE AS OF 2026-09-23, and every reader has to handle both.
// The two fasting entries are CLAUSE FRAGMENTS, lowercase and unpunctuated, written to sit
// after the word "because". cycle_day_unknown is now a WHOLE SENTENCE, founder-approved
// verbatim, because it is the one a woman reads in three different places and it had to say
// the same thing in all of them.
//
// A reader tells them apart by the value itself (initial capital plus a final period), which
// is what reportDeferredNote does below. That is deliberately a property of the STRING and not
// a second key, so adding a reason cannot mean remembering to update a parallel list.
~~~~

Now reads:

~~~~
// ══════════════════════════════════════════════════════════════════════════
// REPORT GENERATOR v1a — in-app health report + provider-ready PDF.
// RENDER-ONLY off results.payload (window.__rdPayload): no model call, no
// scoring, no ranges, no status re-derivation. Reuses esc / sysStatus /
// isSuppressed / longiOverview / longiMove / markerName / gapName / gapSysName /
// dropSuppressedQW / fmtPanelDate / firstName and the GAP_* suppression sets.
// Sections: S1 Snapshot, S2 Longitudinal, S5 Provider points, S6 Monitoring.
// S3 (risk clusters) and S4 (future outlook) are DEFERRED to v1b — the only
// cluster data in the payload (cluster_patterns) is Call B synthesis, not
// engine/system-detected, so v1a omits it per the build brief.
// ══════════════════════════════════════════════════════════════════════════
// TWO SHAPES LIVE IN THIS TABLE AS OF 2026-09-23, and every reader has to handle both.
// The two fasting entries are CLAUSE FRAGMENTS, lowercase and unpunctuated, written to sit
// after the word "because". cycle_day_unknown is now a WHOLE SENTENCE,
// because it is the one a woman reads in three different places and it had to say
// the same thing in all of them.
//
// A reader tells them apart by the value itself (initial capital plus a final period), which
// is what reportDeferredNote does below. That is deliberately a property of the STRING and not
// a second key, so adding a reason cannot mean remembering to update a parallel list.
~~~~

### dashboard.html:6581 (stripped, js-line)

~~~~
// Row-level "no scored band, show the unscored placeholder and the honest note". A SUBSET of
// REPORT_NOT_SCORED_STATUS: the others each have their own row treatment already (unknown_unit
// has its own ruled copy, no_value shows nothing, supplement_high and life_stage_reference are
// real readings with their own calm labels). Declared once because markerRowHTML and
// markerDetailHTML both ask this question and a row that says "result not scored" must not
// expand into a trend chart.
~~~~

Now reads:

~~~~
// Row-level "no scored band, show the unscored placeholder and the honest note". A SUBSET of
// REPORT_NOT_SCORED_STATUS: the others each have their own row treatment already (unknown_unit
// has its own copy, no_value shows nothing, supplement_high and life_stage_reference are
// real readings with their own calm labels). Declared once because markerRowHTML and
// markerDetailHTML both ask this question and a row that says "result not scored" must not
// expand into a trend chart.
~~~~

### dashboard.html:6589 (stripped, js-line)

~~~~
// ── TWO ALLOWLISTS, AND WHY THEY ARE ALLOWLISTS ─────────────────────────────────────────────
// Both of these replaced an `else` / `!has(...)` that decided "healthy" by EXCLUSION, and both
// were measured shipping a wrong answer on this page:
//   unknown_unit reached "In range" through the theme panel's catch-all else, then needs_review
//   did the same after it, on 2026-09-21. A status nobody had written a branch for was presented
//   to a woman as a healthy result.
// An exclusion test fails OPEN: the set of things it lets through is everything the author did
// not think of, which grows every time the engine gains a status. An allowlist fails CLOSED: a
// status nobody has ruled on is treated as unread, which is the honest answer to "we do not know
// what this is". The cost is that adding a genuinely healthy status needs an edit here, and that
// edit is exactly the deliberate decision that was missing both times.
// KEEP THESE IN SYNC WITH THE ENGINE. Its live vocabulary on 2026-09-21 is nine values:
// optimal, normal, watch, flag, not_scored, unknown_unit, no_value, supplement_high, needs_review.
~~~~

Now reads:

~~~~
// ── TWO ALLOWLISTS, AND WHY THEY ARE ALLOWLISTS ─────────────────────────────────────────────
// Both of these replaced an `else` / `!has(...)` that decided "healthy" by EXCLUSION, and both
// were measured shipping a wrong answer on this page:
//   unknown_unit reached "In range" through the theme panel's catch-all else, then needs_review
//   did the same after it, on 2026-09-21. A status nobody had written a branch for was presented
//   to a woman as a healthy result.
// An exclusion test fails OPEN: the set of things it lets through is everything the author did
// not think of, which grows every time the engine gains a status. An allowlist fails CLOSED: a
// status not on the list is treated as unread, which is the honest answer to "we do not know
// what this is". The cost is that adding a genuinely healthy status needs an edit here, and that
// edit is exactly the deliberate decision that was missing both times.
// KEEP THESE IN SYNC WITH THE ENGINE. Its live vocabulary on 2026-09-21 is nine values:
// optimal, normal, watch, flag, not_scored, unknown_unit, no_value, supplement_high, needs_review.
~~~~

### dashboard.html:7114 (stripped, js-line)

~~~~
// VERBATIM COPY of BANNED_PREVALENCE_PHRASES in the worker's prevalence-guard.ts
// (PREVALENCE_GUARD_V1, ruled 2026-09-21). Copied rather than paraphrased so both
// sides drop the same words; the worker guards what Call D generates, this guards
// what Call B already wrote into a payload stored before that guard existed.
// Matched case-insensitively on WORD BOUNDARIES, which is what keeps "uncommon"
// and "commonplace" out of the match.
~~~~

Now reads:

~~~~
// VERBATIM COPY of BANNED_PREVALENCE_PHRASES in the worker's prevalence-guard.ts
// (PREVALENCE_GUARD_V1). Copied rather than paraphrased so both
// sides drop the same words; the worker guards what Call D generates, this guards
// what Call B already wrote into a payload stored before that guard existed.
// Matched case-insensitively on WORD BOUNDARIES, which is what keeps "uncommon"
// and "commonplace" out of the match.
~~~~

### dashboard.html:7128 (stripped, js-line)

~~~~
// Stems, matched at a word boundary on the LEFT only, so "ordered", "prescribing",
// "diagnostic", "medications", "doses", "requested", "repeating" and "workups" all match
// while "border", "disorder" and "overdose" do not. A question that tells a clinician what
// to order, prescribe or diagnose is the one thing this page must never do.
//
// WIDENED 2026-09-23 from five stems to nine, after the founder read a printed PDF. The
// first five caught a point that said "order" and let through one that said "request the
// same panel again", which is the same instruction in politer words.
//
// STRONGER THAN THE WORKER'S LIST ON PURPOSE, and this is worth knowing. The Call B guard
// in biowellth-backend-supa (provider-point-guard.ts, PROVIDER_POINT_GUARD_V1) rules the
// same nine words but stores the LITERAL forms "prescribe" and "medication", so it misses
// "prescribing" and "medicated". These are stems, so they do not. The two lists agree on
// what is banned and this one catches more inflections; a point that survives there can
// still be dropped here, which is the safe direction for the surface she carries.
~~~~

Now reads:

~~~~
// Stems, matched at a word boundary on the LEFT only, so "ordered", "prescribing",
// "diagnostic", "medications", "doses", "requested", "repeating" and "workups" all match
// while "border", "disorder" and "overdose" do not. A question that tells a clinician what
// to order, prescribe or diagnose is the one thing this page must never do.
//
// WIDENED 2026-09-23 from five stems to nine. The
// first five caught a point that said "order" and let through one that said "request the
// same panel again", which is the same instruction in politer words.
//
// STRONGER THAN THE WORKER'S LIST ON PURPOSE, and this is worth knowing. The Call B guard
// in biowellth-backend-supa (provider-point-guard.ts, PROVIDER_POINT_GUARD_V1) rules the
// same nine words but stores the LITERAL forms "prescribe" and "medication", so it misses
// "prescribing" and "medicated". These are stems, so they do not. The two lists agree on
// what is banned and this one catches more inflections; a point that survives there can
// still be dropped here, which is the safe direction for the surface she carries.
~~~~

### dashboard.html:7180 (stripped, js-line)

~~~~
// "work up" and "work-up" are the SAME WORD as "workup" and a model writes all three. The
// ruled list stays at nine; this folds the spacings onto the listed one before matching.
~~~~

Now reads:

~~~~
// "work up" and "work-up" are the SAME WORD as "workup" and a model writes all three. The
// list stays at nine; this folds the spacings onto the listed one before matching.
~~~~

### dashboard.html:7385 (stripped, js-line)

~~~~
// BioWellth range for the table cell. ONE source of the directional logic, which is
// healthyRangeText -- this only drops its leading word, because a column already
// headed "BioWellth range" does not need the word "Healthy" in every cell.
//
// LABELLED IN THE CANONICAL UNIT, not the printed one. ranges-slim.json carries no
// unit at all (measured: 228 entries, zero with a unit key); its bounds are the
// library's, in the library's unit, and the payload carries that as canonical_unit.
// Labelling a library bound with the lab's printed unit would be a silent unit claim.
//
// A SENSITIVE MARKER NEVER GETS A RANGE. Same rule the priority chips already apply
// (a range for a toxic marker invites reading a ceiling as a target), and the same
// answer a marker missing from ranges-slim gets, so no number can appear either way.
// UNIT SPELLING, and why this fold is deliberately narrow. The value column prints the unit
// as the LAB printed it and the range column prints the LIBRARY's, and on 2026-09-23 the
// founder found a row reading "\u00b5mol/L" in one column and "umol/L" in the other. That is one
// unit spelled two ways and it reads as a discrepancy a clinician has to resolve.
//
// So the range column adopts the VALUE column's spelling, but ONLY when the two strings are
// the same unit under a fold of things that cannot change meaning: the two micro signs
// (\u00b5 U+00B5 and \u03bc U+03BC) against a plain u, ASCII case, and whitespace.
//
// EVERYTHING ELSE IS LEFT ALONE, and that is the load-bearing half. Measured on the rendered
// table of one real panel, 13 of 18 rows already agreed, one was the micro-sign case this
// folds, and THREE were genuinely different units in the same row (\u00b5IU/mL against mIU/L,
// \u00b5g/mL against mg/L, \u00b5g/mg of Creatinine against mg/g). Folding those would print the
// lab's unit beside the library's numbers, which is a false unit claim and a worse defect
// than the one being fixed. When the fold does not match, the canonical unit stands.
~~~~

Now reads:

~~~~
// BioWellth range for the table cell. ONE source of the directional logic, which is
// healthyRangeText -- this only drops its leading word, because a column already
// headed "BioWellth range" does not need the word "Healthy" in every cell.
//
// LABELLED IN THE CANONICAL UNIT, not the printed one. ranges-slim.json carries no
// unit at all (measured: 228 entries, zero with a unit key); its bounds are the
// library's, in the library's unit, and the payload carries that as canonical_unit.
// Labelling a library bound with the lab's printed unit would be a silent unit claim.
//
// A SENSITIVE MARKER NEVER GETS A RANGE. Same rule the priority chips already apply
// (a range for a toxic marker invites reading a ceiling as a target), and the same
// answer a marker missing from ranges-slim gets, so no number can appear either way.
// UNIT SPELLING, and why this fold is deliberately narrow. The value column prints the unit
// as the LAB printed it and the range column prints the LIBRARY's, and on 2026-09-23 a row
// read "\u00b5mol/L" in one column and "umol/L" in the other. That is one
// unit spelled two ways and it reads as a discrepancy a clinician has to resolve.
//
// So the range column adopts the VALUE column's spelling, but ONLY when the two strings are
// the same unit under a fold of things that cannot change meaning: the two micro signs
// (\u00b5 U+00B5 and \u03bc U+03BC) against a plain u, ASCII case, and whitespace.
//
// EVERYTHING ELSE IS LEFT ALONE, and that is the load-bearing half. Measured on the rendered
// table of one real panel, 13 of 18 rows already agreed, one was the micro-sign case this
// folds, and THREE were genuinely different units in the same row (\u00b5IU/mL against mIU/L,
// \u00b5g/mL against mg/L, \u00b5g/mg of Creatinine against mg/g). Folding those would print the
// lab's unit beside the library's numbers, which is a false unit claim and a worse defect
// than the one being fixed. When the fold does not match, the canonical unit stands.
~~~~

### dashboard.html:7482 (removed, js-line)

~~~~
// doctorFirstSentence lived here and is GONE 2026-09-23 with the note row it fed. It had one
// caller and no other, so it goes out in the same commit rather than being left behind as a
// helper someone later wires back in without the decision that removed it.
~~~~

### dashboard.html:7549 (stripped, js-line)

~~~~
// NO NOTE ROW. A one-sentence why_this_matters under each finding was removed 2026-09-23
    // after the founder read the printed PDF. The table states the value, the range, the
    // status and the previous reading; a sentence of model prose under it restated what the
    // row already said and pushed the sheet longer. The table alone carries the finding, and
    // her own words in the two editable sections carry everything the table cannot.
~~~~

Now reads:

~~~~
// NO NOTE ROW. A one-sentence why_this_matters under each finding was removed 2026-09-23.
    // The table states the value, the range, the
    // status and the previous reading; a sentence of model prose under it restated what the
    // row already said and pushed the sheet longer. The table alone carries the finding, and
    // her own words in the two editable sections carry everything the table cannot.
~~~~

### dashboard.html:7558 (stripped, js-line)

~~~~
// ── Section 3b, safety checks for a clinician ──────────────────────────────────
// DOCTOR_SAFETY_CHECKS_V1, founder ruling 2026-09-28: the doctor summary is the home for
// safety-check results, and Sana shows them only on request. So this page must list every one
// that is out of range, whether or not it became a ranked priority.
//
// THE SOURCE IS payload.systems[].markers[].band, NOT priorities. renderDashboard moves safety
// priorities into p.__sensitivePriorities, and "Findings to discuss" reads p.priorities only, so a
// safety finding never reaches that table. Reading __sensitivePriorities instead would still miss
// a safety marker that is out of range without being ranked. Every scored marker carries its band
// in systems[].markers[], so that walk sees all of them.
//
// "Out of range" is the SAME rule cardStatus and doctorStatusWord apply: a non-empty band outside
// the class's clean set. A sensitive marker filed under a non-safety system has no clean set, so
// only optimal and negative count as clean for it; an unknown band lists rather than passing.
//
// Each line states the marker, its group, the engine's band and the draw date, as scored. No
// value, no range, no interpretation, and nothing about any other result.
~~~~

Now reads:

~~~~
// ── Section 3b, safety checks for a clinician ──────────────────────────────────
// DOCTOR_SAFETY_CHECKS_V1: the doctor summary is the home for
// safety-check results, and Sana shows them only on request. So this page must list every one
// that is out of range, whether or not it became a ranked priority.
//
// THE SOURCE IS payload.systems[].markers[].band, NOT priorities. renderDashboard moves safety
// priorities into p.__sensitivePriorities, and "Findings to discuss" reads p.priorities only, so a
// safety finding never reaches that table. Reading __sensitivePriorities instead would still miss
// a safety marker that is out of range without being ranked. Every scored marker carries its band
// in systems[].markers[], so that walk sees all of them.
//
// "Out of range" is the SAME rule cardStatus and doctorStatusWord apply: a non-empty band outside
// the class's clean set. A sensitive marker filed under a non-safety system has no clean set, so
// only optimal and negative count as clean for it; an unknown band lists rather than passing.
//
// Each line states the marker, its group, the engine's band and the draw date, as scored. No
// value, no range, no interpretation, and nothing about any other result.
~~~~

### dashboard.html:7765 (stripped, js-line)

~~~~
// ── Section 6, the reading conditions ──────────────────────────────────────────
// WAS "Not read on this panel", WITH ONE LINE PER DEFERRED SYSTEM. Both were wrong and the
// founder caught them on the printed PDF.
//
// A DEFERRAL IS A SCORING EXCLUSION, NOT AN UNREAD MARKER. The engine defers a system from
// the composite when it cannot score it fairly; the markers themselves were measured and
// several of them can be sitting in the table on the page above. So a line saying a system
// was "not read" contradicted the rows a clinician was looking at while reading it. Every
// system-level line is gone and nothing replaces it.
//
// WHAT SURVIVES IS ONLY WHAT CHANGES HOW A RESULT IS READ. Two things do.
//
// FASTING, and only for the markers it actually moves. Glucose, insulin and triglycerides
// move with the last meal. ApoA1 and ApoB do not, which is why this never says "lipids":
// naming the lipid panel would tell a clinician to discount two results that are valid
// whatever she ate. The line renders only when at least one of those three markers is in
// the payload, so a panel without them never carries a caveat about results it does not
// contain.
//
// CYCLE GATING, unchanged. A held hormone is genuinely unread and saying so is correct.
~~~~

Now reads:

~~~~
// ── Section 6, the reading conditions ──────────────────────────────────────────
// WAS "Not read on this panel", WITH ONE LINE PER DEFERRED SYSTEM. Both were wrong.
//
// A DEFERRAL IS A SCORING EXCLUSION, NOT AN UNREAD MARKER. The engine defers a system from
// the composite when it cannot score it fairly; the markers themselves were measured and
// several of them can be sitting in the table on the page above. So a line saying a system
// was "not read" contradicted the rows a clinician was looking at while reading it. Every
// system-level line is gone and nothing replaces it.
//
// WHAT SURVIVES IS ONLY WHAT CHANGES HOW A RESULT IS READ. Two things do.
//
// FASTING, and only for the markers it actually moves. Glucose, insulin and triglycerides
// move with the last meal. ApoA1 and ApoB do not, which is why this never says "lipids":
// naming the lipid panel would tell a clinician to discount two results that are valid
// whatever she ate. The line renders only when at least one of those three markers is in
// the payload, so a panel without them never carries a caveat about results it does not
// contain.
//
// CYCLE GATING, unchanged. A held hormone is genuinely unread and saying so is correct.
~~~~

### dashboard.html:7874 (stripped, js-line)

~~~~
// Hero-summary band clause, keyed on vitality.band.key. Authored (NOT reusing VERDICT_BAND, whose key
// drift is a separate open ruling). No entry for suppressed — that branch owns its own screen.
~~~~

Now reads:

~~~~
// Hero-summary band clause, keyed on vitality.band.key. Authored (NOT reusing VERDICT_BAND, whose key
// drift is separate). No entry for suppressed — that branch owns its own screen.
~~~~

### dashboard.html:8459 (stripped, js-line)

~~~~
// ────────────────────────────────────────────────────────────────────────────
// DAILY_CARD_V1 — Sana daily actions card + deterministic scheduler.
// Renders as the first element on the Sana home surface, above the report reveal.
// Reuses the existing `sb` client and `USER` session — never a second client. An
// empty action_pool renders NO card at all (no placeholder, no error state). Phase
// flavor lines are gated by the LOCKED Option-A rule (founder-ratified): they render
// ONLY for a 'regular' cycler with a usable recent LMP and in-range cycle length +
// period duration; any other case is base text only, zero phase language. The BE
// phaseKeyFor stub is deliberately NOT mirrored (it has no menstrual phase and is
// non-final) — this FE display mapping diverges on purpose, queued for advisor eyes.
// ────────────────────────────────────────────────────────────────────────────
~~~~

Now reads:

~~~~
// ────────────────────────────────────────────────────────────────────────────
// DAILY_CARD_V1 — Sana daily actions card + deterministic scheduler.
// Renders as the first element on the Sana home surface, above the report reveal.
// Reuses the existing `sb` client and `USER` session — never a second client. An
// empty action_pool renders NO card at all (no placeholder, no error state). Phase
// flavor lines are gated by the LOCKED Option-A rule: they render
// ONLY for a 'regular' cycler with a usable recent LMP and in-range cycle length +
// period duration; any other case is base text only, zero phase language. The BE
// phaseKeyFor stub is deliberately NOT mirrored (it has no menstrual phase and is
// non-final) — this FE display mapping diverges on purpose.
// ────────────────────────────────────────────────────────────────────────────
~~~~

### dashboard.html:8492 (stripped, js-line)

~~~~
// CYCLE_MOVEMENT_V1 — the phase is no longer decided on this page. dcResolvePhase (the LOCKED
// Option-A mapping) is SUPERSEDED by the shared module js/cycle-movement.js, byte-identical to
// supa supabase/functions/_shared/cycle-movement.js and backend-branches
// src/services/cycle-movement.js, so the daily card and Sana can never disagree about where she
// is. Rulings: supa docs/cycle-movement-orient-2026-10-12.md section 7, approved 2026-10-12.
//
// What the module keeps from Option A: the same four flavor keys, the same boundaries for days
// 1..L (pinned against the old function in scripts/test-cycle-movement.mjs), regular cyclers only,
// L 21-35, P 2-8, and no 28-day guess for a missing cycle length.
// What it changes, each by ruling:
//   - the period date is the LATER of profiles.last_period_start_date and the report's
//     lmp_date_before_draw (R6, the read-both step of the 0058 work), where Option A read the
//     report's date only;
//   - past L+7 days she gets NO phase. Option A wrapped the cycle day modulo L up to 90 days, so
//     a date two cycles old still produced a confident phase;
//   - pregnancy, postpartum, postmenopause, current hormonal contraception, hormone therapy,
//     perimenopause, PCOS and an absent period all withhold the phase (R3-R5);
//   - a missing period length defaults to 5 and is flagged (R1), where Option A withheld.
//
// The module is a plain ES module loaded with a dynamic import, because it must stay
// byte-identical across three repositories and so cannot be pasted into this block. The query is
// the first 8 hex of its sha256, so a changed module is a changed URL (the Fastly cache key) and
// scripts/test-cycle-movement.mjs fails if the two drift. A failed load leaves every row unphased
// and the movement row absent: the card itself never depends on it.
~~~~

Now reads:

~~~~
// CYCLE_MOVEMENT_V1 — the phase is no longer decided on this page. dcResolvePhase (the LOCKED
// Option-A mapping) is SUPERSEDED by the shared module js/cycle-movement.js, byte-identical to
// supa supabase/functions/_shared/cycle-movement.js and backend-branches
// src/services/cycle-movement.js, so the daily card and Sana can never disagree about where she
// is.
//
// What the module keeps from Option A: the same four flavor keys, the same boundaries for days
// 1..L (pinned against the old function in scripts/test-cycle-movement.mjs), regular cyclers only,
// L 21-35, P 2-8, and no 28-day guess for a missing cycle length.
// What it changes:
//   - the period date is the LATER of profiles.last_period_start_date and the report's
//     lmp_date_before_draw (R6, the read-both step of the 0058 work), where Option A read the
//     report's date only;
//   - past L+7 days she gets NO phase. Option A wrapped the cycle day modulo L up to 90 days, so
//     a date two cycles old still produced a confident phase;
//   - pregnancy, postpartum, postmenopause, current hormonal contraception, hormone therapy,
//     perimenopause, PCOS and an absent period all withhold the phase (R3-R5);
//   - a missing period length defaults to 5 and is flagged (R1), where Option A withheld.
//
// The module is a plain ES module loaded with a dynamic import, because it must stay
// byte-identical across three repositories and so cannot be pasted into this block. The query is
// the first 8 hex of its sha256, so a changed module is a changed URL (the Fastly cache key) and
// scripts/test-cycle-movement.mjs fails if the two drift. A failed load leaves every row unphased
// and the movement row absent: the card itself never depends on it.
~~~~

### dashboard.html:8516 (stripped, js-line)

~~~~
// REGULAR_CYCLER_V1 + IRREGULAR_DAYS_SINCE_V1: was v=14d709cb (DAYS_SINCE_V2), v=23dfc9e2 (V1), v=6aec9b31 before that; moves with the module bytes
~~~~

Now reads:

~~~~
// REGULAR_CYCLER_V1 + IRREGULAR_DAYS_SINCE_V1: moves with the module bytes
~~~~

### dashboard.html:8534 (stripped, js-line)

~~~~
// FOOD_GUARD_V1 — never red meat, ruled 2026-10-20. The SAME file supa runs at write time
// (js/food-guard.js, byte-identical to supa _shared/food-guard.js, pinned by scripts/test-food-guard.mjs;
// the query is its sha256 prefix, the cache key). Applied to the whole pool before scheduling, with the
// write-time rules: a banned base_text drops the action, a banned phase note drops only that note. No diet
// is passed (phase 1), which reads as Vegetarian. This covers the actions stored before the write-time
// guard existed. A failed load shows NO card: an unchecked action is the thing the guard exists to keep out.
~~~~

Now reads:

~~~~
// FOOD_GUARD_V1 — never red meat. The SAME file supa runs at write time
// (js/food-guard.js, byte-identical to supa _shared/food-guard.js, pinned by scripts/test-food-guard.mjs;
// the query is its sha256 prefix, the cache key). Applied to the whole pool before scheduling, with the
// write-time rules: a banned base_text drops the action, a banned phase note drops only that note. No diet
// is passed (phase 1), which reads as Vegetarian. This covers the actions stored before the write-time
// guard existed. A failed load shows NO card: an unchecked action is the thing the guard exists to keep out.
~~~~

### dashboard.html:8651 (stripped, js-line)

~~~~
// DAILY_CARD_PRIORITY_LABEL_V1 — the priority a row is aimed at, named the way she would
// recognise it on her own lab report. GAP_MARKER_NAME is the ONLY id->display-name source on
// this page; ranges-slim.json holds range bounds under both its keys and no names at all.
//
// RULED 2026-09-21: the parenthetical is used ONLY when it holds TWO OR MORE CONSECUTIVE
// CAPITALS **and** is SHORTER than the text before it. Otherwise the text before it is used.
// No parenthetical -> the whole name. If the chosen part is empty use the other; if both are,
// no label.
//
// BOTH clauses are load-bearing, and each was earned by a label that shipped wrong:
//
//   length alone   'Magnesium (Serum)' -> 'Serum', 'Vitamin B12 (serum)' -> 'serum'.
//                  A specimen word is shorter than the marker it qualifies.
//   capitals alone 'Vitamin D (25-OH total)' -> '25-OH total', because the OH in 25-OH is a
//                  capital run inside a phrase that is not an abbreviation.
//
// Together they read as: prefer the parenthetical only when it looks like an ABBREVIATION of
// the name, which is a run of capitals, AND is actually more compact than the name.
//
// 'ALT (SGPT)' needs no special case: SGPT is 4 characters against ALT's 3, so the length
// clause rejects it and the label is ALT -- the name printed on her panel, not the older
// name for the same enzyme. tests/PIN alt pins that by name.
//
// An id that does not resolve renders NO label — not a fallback, not the raw id, not an empty
// chip. Four ids do not resolve today (11_deoxycortisol, folate_lcmsms, globulin, uacr),
// covering 39 of 650 pool rows, so this path is live and not defensive.
~~~~

Now reads:

~~~~
// DAILY_CARD_PRIORITY_LABEL_V1 — the priority a row is aimed at, named the way she would
// recognise it on her own lab report. GAP_MARKER_NAME is the ONLY id->display-name source on
// this page; ranges-slim.json holds range bounds under both its keys and no names at all.
//
// The parenthetical is used ONLY when it holds TWO OR MORE CONSECUTIVE
// CAPITALS **and** is SHORTER than the text before it. Otherwise the text before it is used.
// No parenthetical -> the whole name. If the chosen part is empty use the other; if both are,
// no label.
//
// BOTH clauses are load-bearing, and each was earned by a label that shipped wrong:
//
//   length alone   'Magnesium (Serum)' -> 'Serum', 'Vitamin B12 (serum)' -> 'serum'.
//                  A specimen word is shorter than the marker it qualifies.
//   capitals alone 'Vitamin D (25-OH total)' -> '25-OH total', because the OH in 25-OH is a
//                  capital run inside a phrase that is not an abbreviation.
//
// Together they read as: prefer the parenthetical only when it looks like an ABBREVIATION of
// the name, which is a run of capitals, AND is actually more compact than the name.
//
// 'ALT (SGPT)' needs no special case: SGPT is 4 characters against ALT's 3, so the length
// clause rejects it and the label is ALT -- the name printed on her panel, not the older
// name for the same enzyme. tests/PIN alt pins that by name.
//
// An id that does not resolve renders NO label — not a fallback, not the raw id, not an empty
// chip. Four ids do not resolve today (11_deoxycortisol, folate_lcmsms, globulin, uacr),
// covering 39 of 650 pool rows, so this path is live and not defensive.
~~~~

### dashboard.html:8732 (stripped, js-line)

~~~~
// CYCLE_MOVEMENT_V1 — the movement row. Its text is the module's own authored copy, never model
// prose, and it is not one of the three tickable actions.
// ONE JOB PER CARD, founder ruling 2026-10-12: the movement line lives HERE and nowhere else; the
// estimate note and the clinician line (line 10) live on the cycle card and never here.
//   phase          -> "Movement for today" and today's movement line.
//   every other status -> nothing, and the reason is never shown.
~~~~

Now reads:

~~~~
// CYCLE_MOVEMENT_V1 — the movement row. Its text is the module's own authored copy, never model
// prose, and it is not one of the three tickable actions.
// ONE JOB PER CARD: the movement line lives HERE and nowhere else; the
// estimate note and the clinician line (line 10) live on the cycle card and never here.
//   phase          -> "Movement for today" and today's movement line.
//   every other status -> nothing, and the reason is never shown.
~~~~

### dashboard.html:8751 (stripped, js-line)

~~~~
// OVULATORY_SHOWS_FOLLICULAR_V1, founder ruling 2026-10-12: nothing she sees names ovulation, so
// when the internal flavor key is ovulatory the card shows Call D's FOLLICULAR note in its place.
// Display only: the key itself, the module and Call D are unchanged. No follicular note, no note;
// the ovulatory note is never a fallback.
// PHASE_NOTE_GUARD_V1: AFTER that remap, the note is shown only if the guard allows it. No guard
// (it failed to load), no note. A dropped note shows no note; the action is unchanged.
~~~~

Now reads:

~~~~
// OVULATORY_SHOWS_FOLLICULAR_V1: nothing she sees names ovulation, so
// when the internal flavor key is ovulatory the card shows Call D's FOLLICULAR note in its place.
// Display only: the key itself, the module and Call D are unchanged. No follicular note, no note;
// the ovulatory note is never a fallback.
// PHASE_NOTE_GUARD_V1: AFTER that remap, the note is shown only if the guard allows it. No guard
// (it failed to load), no note. A dropped note shows no note; the action is unchanged.
~~~~

### dashboard.html:8847 (stripped, js-line)

~~~~
// ────────────────────────────────────────────────────────────────────────────
// CYCLE_CARD_V1 — her cycle day, phase and today's movement line. Built from mocks/cycle-card.html
// with the founder's 2026-10-12 rulings. EVERYTHING SHOWN COMES FROM THE SHARED MODULE through
// cmResolveFor, the same read the daily card uses: this card computes no phase, no day and no date.
//   phase                  -> Day N of ~L, the module's phaseLabel (Menstrual, Follicular, Early
//                             luteal, Late luteal; no ovulation state, ruled), next period "estimated",
//                             the estimate note, Log period. NO movement line: ONE JOB PER CARD
//                             (2026-10-12), the daily card's movement row is its only home.
//   log_period/lmp_unknown -> the module's STATUS_LINES.log_period and Log period.
//   raise_with_clinician   -> the module's line only (line 10; this card is its only home).
//   CYCLE_CARD_DAYCOUNT_V1 (2026-10-18, mock revision 3). N is the module's daysSince + 1, so day 1 is
//   the day the period started, as on the phase card. Nothing else is worked out here.
//   cycle_length_unknown   -> with a date, "Day N since your last period" and a small link that opens
//                             the cycle-length ask (24 to 35, or typed), saved through onb2Write with
//                             onb2Int's 15 to 90, then this card and the daily card re-render; Log
//                             period below the link. With no date, the live Log period card above,
//                             the log_period/lmp_unknown markup (cyLogCardHTML) with CY_COPY.logPlain,
//                             since logging alone does not unlock movement ideas there.
//   out_of_range_inputs,   -> "Day N since your last period" and Log period. The clinician line shows
//   log_period/overdue        only when N > 35 (CY_LONG_DAYS). out_of_range_inputs with no date gets
//                             the same logPlain card (2026-10-18 rulings).
//   no_phase/irregular     -> IRREGULAR_DAYS_SINCE_V1 (2026-10-18). Irregular, PCOS and perimenopause:
//                             with a date, "Day N since your last period" and Log period. NEVER a phase,
//                             a day of ~L or an estimate, and never the reason. With no date, NOTHING: the
//                             reason also covers cycle_status "none" ("Doesn't apply to me"), and a bare
//                             Log period prompt would ask her for a period she said does not apply.
//   EVERYTHING ELSE        -> NOTHING. Pregnancy, postmenopause, contraception, hormone therapy and
//                             unreadable inputs all render no card and never a reason.
//                             (Corrected 2026-10-18: this line listed perimenopause and PCOS here until
//                             IRREGULAR_DAYS_SINCE_V1 gave them the day count above.)
// "Log period" posts process-report mode log_period (supa LOG_PERIOD_V1) through the page's
// sb.functions.invoke pattern (onDdcTap, the retry handler), then re-renders this card and the daily card.
~~~~

Now reads:

~~~~
// ────────────────────────────────────────────────────────────────────────────
// CYCLE_CARD_V1 — her cycle day, phase and today's movement line. Built from mocks/cycle-card.html.
// EVERYTHING SHOWN COMES FROM THE SHARED MODULE through
// cmResolveFor, the same read the daily card uses: this card computes no phase, no day and no date.
//   phase                  -> Day N of ~L, the module's phaseLabel (Menstrual, Follicular, Early
//                             luteal, Late luteal; no ovulation state), next period "estimated",
//                             the estimate note, Log period. NO movement line: ONE JOB PER CARD
//                             (2026-10-12), the daily card's movement row is its only home.
//   log_period/lmp_unknown -> the module's STATUS_LINES.log_period and Log period.
//   raise_with_clinician   -> the module's line only (line 10; this card is its only home).
//   CYCLE_CARD_DAYCOUNT_V1 (2026-10-18, mock revision 3). N is the module's daysSince + 1, so day 1 is
//   the day the period started, as on the phase card. Nothing else is worked out here.
//   cycle_length_unknown   -> with a date, "Day N since your last period" and a small link that opens
//                             the cycle-length ask (24 to 35, or typed), saved through onb2Write with
//                             onb2Int's 15 to 90, then this card and the daily card re-render; Log
//                             period below the link. With no date, the live Log period card above,
//                             the log_period/lmp_unknown markup (cyLogCardHTML) with CY_COPY.logPlain,
//                             since logging alone does not unlock movement ideas there.
//   out_of_range_inputs,   -> "Day N since your last period" and Log period. The clinician line shows
//   log_period/overdue        only when N > 35 (CY_LONG_DAYS). out_of_range_inputs with no date gets
//                             the same logPlain card.
//   no_phase/irregular     -> IRREGULAR_DAYS_SINCE_V1 (2026-10-18). Irregular, PCOS and perimenopause:
//                             with a date, "Day N since your last period" and Log period. NEVER a phase,
//                             a day of ~L or an estimate, and never the reason. With no date, NOTHING: the
//                             reason also covers cycle_status "none" ("Doesn't apply to me"), and a bare
//                             Log period prompt would ask her for a period she said does not apply.
//   EVERYTHING ELSE        -> NOTHING. Pregnancy, postmenopause, contraception, hormone therapy and
//                             unreadable inputs all render no card and never a reason.
//                             (Corrected 2026-10-18: this line listed perimenopause and PCOS here until
//                             IRREGULAR_DAYS_SINCE_V1 gave them the day count above.)
// "Log period" posts process-report mode log_period (supa LOG_PERIOD_V1) through the page's
// sb.functions.invoke pattern (onDdcTap, the retry handler), then re-renders this card and the daily card.
~~~~

### dashboard.html:8894 (stripped, js-line)

~~~~
// PROPOSED 2026-10-18; the two no-date cases only, lmp_unknown keeps the module's line
~~~~

Now reads:

~~~~
// The two no-date cases only, lmp_unknown keeps the module's line
~~~~

### dashboard.html:9112 (stripped, js-line)

~~~~
// DENSITY_COLLAPSE_V1 — the disclosure labels for every collapsed section on the dashboard.
// ONE pair, shared by the priority cards, the going-right cards and the foundations levers, so
// the three surfaces cannot drift into saying three different things about the same gesture.
//
// Before this commit the priority toggle carried a SINGLE static string, "See the detail", set
// once in the markup and never rewritten -- the only open-state signal was the chevron rotating
// in CSS. Measured: zero textContent writes on .prio-toggle, against a live control of one on
// the reveal deck's see-all button. So the open label is new, not a rename of an existing one.
//
// Written into a dedicated .*-toggle-label SPAN, never onto the button. The button also holds
// the chevron span, and assigning button.textContent would delete the chevron -- which is how
// the reveal deck's see-all toggle can get away with the simpler form and this one cannot.
//
// No colon and no em dash, per the copy tone rule.
// CHANGED 2026-09-23 from { "See more details", "Hide details" }, on the founder's explicit
// instruction, as part of moving the expander to the right of the headline. The long pair did
// not fit a right-hand column beside a 20px headline without crowding it.
//
// IT WAS A RATIFIED PAIR AND THIS IS RECORDED RATHER THAN QUIETLY REPLACED.
// scripts/test-density-collapse.mjs asserted it under the name "the ratified pair"; that
// assertion is updated in the same commit, so the pin still exists and still names what it is.
// Reversing this is one edit here and one there.
~~~~

Now reads:

~~~~
// DENSITY_COLLAPSE_V1 — the disclosure labels for every collapsed section on the dashboard.
// ONE pair, shared by the priority cards, the going-right cards and the foundations levers, so
// the three surfaces cannot drift into saying three different things about the same gesture.
//
// Before this commit the priority toggle carried a SINGLE static string, "See the detail", set
// once in the markup and never rewritten -- the only open-state signal was the chevron rotating
// in CSS. Measured: zero textContent writes on .prio-toggle, against a live control of one on
// the reveal deck's see-all button. So the open label is new, not a rename of an existing one.
//
// Written into a dedicated .*-toggle-label SPAN, never onto the button. The button also holds
// the chevron span, and assigning button.textContent would delete the chevron -- which is how
// the reveal deck's see-all toggle can get away with the simpler form and this one cannot.
//
// No colon and no em dash, per the copy tone rule.
// CHANGED 2026-09-23 from { "See more details", "Hide details" },
// as part of moving the expander to the right of the headline. The long pair did
// not fit a right-hand column beside a 20px headline without crowding it.
//
// scripts/test-density-collapse.mjs asserted it under the name "the ratified pair"; that
// assertion is updated in the same commit, so the pin still exists and still names what it is.
// Reversing this is one edit here and one there.
~~~~

### dashboard.html:9298 (stripped, js-line)

~~~~
// THE HERO COVERAGE LINE IS RETIRED, 2026-09-23, at the founder's ruling. Its sentence now
  // opens the "What's this?" popover, where it sits beside the paragraph explaining the score it
  // qualifies. #coverage-line stays in the markup with its id so readers and tests resolve; it is
  // cleared and hidden here on EVERY render rather than merely left alone, so the guarantee is a
  // line of code and not an assumption about who else might write to it.
  //
  // THIS RETIREMENT RIDES IN THE POPOVER COMMIT, not the hero one, because renderCoverageLine
  // became coverageSentence in the same change. A commit that renames the function and leaves
  // this call standing throws a ReferenceError on every render, and on this repo a push is a
  // deploy, so an intermediate commit has to be shippable too.
~~~~

Now reads:

~~~~
// THE HERO COVERAGE LINE IS RETIRED, 2026-09-23. Its sentence now
  // opens the "What's this?" popover, where it sits beside the paragraph explaining the score it
  // qualifies. #coverage-line stays in the markup with its id so readers and tests resolve; it is
  // cleared and hidden here on EVERY render rather than merely left alone, so the guarantee is a
  // line of code and not an assumption about who else might write to it.
  //
  // THIS RETIREMENT RIDES IN THE POPOVER COMMIT, not the hero one, because renderCoverageLine
  // became coverageSentence in the same change. A commit that renames the function and leaves
  // this call standing throws a ReferenceError on every render, and on this repo a push is a
  // deploy, so an intermediate commit has to be shippable too.
~~~~

### dashboard.html:9392 (stripped, js-line)

~~~~
// "Gaps to test" is the only one of the four with no colour of its own to carry, so it
      // takes the hero's cream at 55%. It was var(--brown-mid) for the length of f4fa2a4, while
      // the row sat on the cream page under #theme-wrap; the row is back on the dark card, so
      // this is back with it. The other three are mid-tone (ST_COLOR coral/amber, teal-mid) and
      // read on both surfaces, which is why this was the only value that ever had to move.
~~~~

Now reads:

~~~~
// "Gaps to test" is the only one of the four with no colour of its own to carry, so it
      // takes the hero's cream at 55%. It was var(--brown-mid) while
      // the row sat on the cream page under #theme-wrap; the row is back on the dark card, so
      // this is back with it. The other three are mid-tone (ST_COLOR coral/amber, teal-mid) and
      // read on both surfaces, which is why this was the only value that ever had to move.
~~~~

### dashboard.html:9457 (stripped, js-line)

~~~~
// MARKER_BAND_V1 — marker_id -> measured value, built in the SAME pass over p.systems and for
  // the same reason the system map is: the object the priority renderer receives does not carry
  // what the renderer needs.
  //
  // MEASURED, NOT ASSUMED. priorities[].primary_markers carry exactly six keys on the current
  // panel -- band, display_name, flag_status, marker_id, model_band, position -- and `value` is
  // NOT among them, while systems[].markers carry value, unit, normalized_value and the rest.
  // So `pm.value` on the priority path is undefined for every marker, and a band keyed on it
  // would have been dead code that no test using a hand-built fixture would ever catch.
  //
  // THIS IS ALSO WHY THE CHIP AT THE CARD FACE SHOWS A BARE NAME. Its label is
  // [markerName(pm), pm.value] filtered for empties, so the value silently drops out. That is a
  // pre-existing defect, it is NOT fixed here, and fixing it is a visible copy change that wants
  // its own ruling rather than riding along inside a band commit.
~~~~

Now reads:

~~~~
// MARKER_BAND_V1 — marker_id -> measured value, built in the SAME pass over p.systems and for
  // the same reason the system map is: the object the priority renderer receives does not carry
  // what the renderer needs.
  //
  // MEASURED, NOT ASSUMED. priorities[].primary_markers carry exactly six keys on the current
  // panel -- band, display_name, flag_status, marker_id, model_band, position -- and `value` is
  // NOT among them, while systems[].markers carry value, unit, normalized_value and the rest.
  // So `pm.value` on the priority path is undefined for every marker, and a band keyed on it
  // would have been dead code that no test using a hand-built fixture would ever catch.
  //
  // THIS IS ALSO WHY THE CHIP AT THE CARD FACE SHOWS A BARE NAME. Its label is
  // [markerName(pm), pm.value] filtered for empties, so the value silently drops out. That is a
  // pre-existing defect, it is NOT fixed here, and fixing it is a visible copy change.
~~~~

### dashboard.html:9763 (stripped, js-line)

~~~~
// SANA_LIVE_COPY_V1, 2026-10-13. CLOSING used to read "This is a small preview. Sana, your full
  // companion who can answer anything about your panel, is arriving soon." That was true while the
  // chips were the only Sana a woman could reach and the chat was built dark. It is FALSE now: the
  // server founder allowlist was reverted and deployed 2026-10-09, consent v3.1 is approved, and
  // SANA_CHAT_ENABLED is true, so every chip answer was telling her Sana was still on the way while
  // the chat sat right under it. The line now points her at that chat instead.
  //
  // WHY "BELOW" IS SAFE TO SAY HERE: sanaMountChat runs a few lines up, before this constant, so on
  // this path the chat has already been built into #sana-mount, which sits under #comp-answer in the
  // markup. The one way it would not be is SANA_CHAT_ENABLED going false again, and anyone flipping
  // that flag back must restore a not-yet-live line here in the same change.
  //
  // Still appended exactly where it was, at the end of each of the four chip answers. Plain, no
  // colon, no em dash.
~~~~

Now reads:

~~~~
// SANA_LIVE_COPY_V1, 2026-10-13. CLOSING used to read "This is a small preview. Sana, your full
  // companion who can answer anything about your panel, is arriving soon." That was true while the
  // chips were the only Sana a woman could reach and the chat was built dark. It is FALSE now: the
  // server allowlist was reverted and deployed 2026-10-09, and
  // SANA_CHAT_ENABLED is true, so every chip answer was telling her Sana was still on the way while
  // the chat sat right under it. The line now points her at that chat instead.
  //
  // WHY "BELOW" IS SAFE TO SAY HERE: sanaMountChat runs a few lines up, before this constant, so on
  // this path the chat has already been built into #sana-mount, which sits under #comp-answer in the
  // markup. The one way it would not be is SANA_CHAT_ENABLED going false again, and anyone flipping
  // that flag back must restore a not-yet-live line here in the same change.
  //
  // Still appended exactly where it was, at the end of each of the four chip answers. Plain, no
  // colon, no em dash.
~~~~

### dashboard.html:9964 (stripped, js-line)

~~~~
// LIFE_STAGE_OPTIONS_V1 (copy approved 2026-10-18). Stored values unchanged. The old
  // perimenopause label led with "My periods have become unpredictable", which a woman
  // with PCOS or any irregular cycle could fairly pick, so the option now names the
  // transition itself and the cycle change rides in the helper line beside the symptoms.
  // An optional third element is a helper line rendered under the label (onb2CardHtml).
  // LIFE_STAGE_DECLARED_V1 (founder rulings 2026-10-18, superseding the labels above them):
  // perimenopause is now stored ONLY when a clinician has told her so, never inferred from
  // changing periods, so the option names the clinician and carries no helper line. The
  // premenopause label is the approved copy, restored 2026-10-19 (it read My periods are
  // predictable for one day, which was never approved). Unpredictable periods are a CYCLE
  // answer: on the cycle question the "Irregular" option is relabelled "Irregular or unpredictable"
  // (value irregular). Stored values unchanged; no new value, no new column. (No apostrophes in
  // comments inside ONB2_SCREENS: test-about-you extractConst reads them as string quotes.)
~~~~

Now reads:

~~~~
// LIFE_STAGE_OPTIONS_V1 (2026-10-18). Stored values unchanged. The old
  // perimenopause label led with "My periods have become unpredictable", which a woman
  // with PCOS or any irregular cycle could fairly pick, so the option now names the
  // transition itself and the cycle change rides in the helper line beside the symptoms.
  // An optional third element is a helper line rendered under the label (onb2CardHtml).
  // LIFE_STAGE_DECLARED_V1 (2026-10-18, superseding the labels above them):
  // perimenopause is now stored ONLY when a clinician has told her so, never inferred from
  // changing periods, so the option names the clinician and carries no helper line.
  // Unpredictable periods are a CYCLE
  // answer: on the cycle question the "Irregular" option is relabelled "Irregular or unpredictable"
  // (value irregular). Stored values unchanged; no new value, no new column. (No apostrophes in
  // comments inside ONB2_SCREENS: test-about-you extractConst reads them as string quotes.)
~~~~

### dashboard.html:10087 (stripped, js-block)

~~~~
/**
 * menstrual_status is DERIVED, never asked. Ruling 2026-09-02.
 *
 * The engine reads it and PREFERS it: resolveMenopause switches on it before it
 * looks at life_stage and deliberately never reads cycle_status, and the Call C
 * prompt is told to weight menstrual_status over cycle_status when they
 * disagree. So writing cycle_status alone and leaving a stale menstrual_status
 * would let the stale value outrank the fresh answer. Lockstep, or not at all.
 *
 * Returns undefined when there is no basis to write, which is different from
 * null (a positive "she has no cycle status").
 */
~~~~

Now reads:

~~~~
/**
 * menstrual_status is DERIVED, never asked.
 *
 * The engine reads it and PREFERS it: resolveMenopause switches on it before it
 * looks at life_stage and deliberately never reads cycle_status, and the Call C
 * prompt is told to weight menstrual_status over cycle_status when they
 * disagree. So writing cycle_status alone and leaving a stale menstrual_status
 * would let the stale value outrank the fresh answer. Lockstep, or not at all.
 *
 * Returns undefined when there is no basis to write, which is different from
 * null (a positive "she has no cycle status").
 */
~~~~

### dashboard.html:10445 (stripped, js-block)

~~~~
/* ── motion, ported verbatim from the approved spec ───────────────────────────
   step / placeOrb / pan / leap are the spec's functions with its numbers intact:
   gap 56, leap 820ms cubic-bezier(.45,.05,.55,.95) on `left` with fill forwards,
   arcY translateY 0 -> -64px @ .5 -> 0 at 820ms linear, land + ack at 830ms, and
   the 1.45s cubic-bezier(.55,.05,.18,1) pan. Not retuned. */
~~~~

Now reads:

~~~~
/* ── motion, ported verbatim from the spec ───────────────────────────────────
   step / placeOrb / pan / leap are the spec's functions with its numbers intact:
   gap 56, leap 820ms cubic-bezier(.45,.05,.55,.95) on `left` with fill forwards,
   arcY translateY 0 -> -64px @ .5 -> 0 at 820ms linear, land + ack at 830ms, and
   the 1.45s cubic-bezier(.55,.05,.18,1) pan. Not retuned. */
~~~~

### dashboard.html:11098 (stripped, js-line)

~~~~
// FACE_SCAN_ENTRY_V1 copy. Founder approved 2026-09-14 and used VERBATIM; do
  // not reword. No colon, no em dash, American spelling. No range or assessment
  // language belongs here. The results screen already carries the approved
  // disclaimer, and saying it twice in different words is how two versions of
  // one promise start to drift.
  // ONE CONSTANT, TWO VARIANTS. R1, 2026-09-16. Was two sibling keys, scanLabel and
  // scanNavLabel, which is two lines to change and two places to forget. They are
  // now one object so a future rename is a single edit at a single key.
  //
  // THE ACTION IS A FACE SCAN. THE OUTPUT IS A READING. Everywhere we ask her to DO
  // it says face scan; everywhere we name what she GETS still says reading, and
  // results.h "Your reading" and the results disclaimer are untouched by this. That
  // distinction is the whole rename and a blanket replace would destroy it.
  //
  // The old label described the mechanism and told a woman nothing.
~~~~

Now reads:

~~~~
// FACE_SCAN_ENTRY_V1 copy. Used VERBATIM; do
  // not reword. No colon, no em dash, American spelling. No range or assessment
  // language belongs here. The results screen already carries the
  // disclaimer, and saying it twice in different words is how two versions of
  // one promise start to drift.
  // ONE CONSTANT, TWO VARIANTS. Was two sibling keys, scanLabel and
  // scanNavLabel, which is two lines to change and two places to forget. They are
  // now one object so a future rename is a single edit at a single key.
  //
  // THE ACTION IS A FACE SCAN. THE OUTPUT IS A READING. Everywhere we ask her to DO
  // it says face scan; everywhere we name what she GETS still says reading, and
  // results.h "Your reading" and the results disclaimer are untouched by this. That
  // distinction is the whole rename and a blanket replace would destroy it.
  //
  // The old label described the mechanism and told a woman nothing.
~~~~

### dashboard.html:11117 (stripped, js-line)

~~~~
// ONE LINE, NOT TWO, as of 2026-09-16. scanDetail is GONE and scanIntro stays
  // verbatim. The distinction that killed the second line, recorded so a future
  // session does not reintroduce a metric list:
  //
  //   scanIntro says what the scan DOES. That is stable.
  //   scanDetail said what she GETS. That is not, and it went stale.
  //
  // It named three metrics while the results card shows four. Two more are requested
  // and stored but not displayed, because the licence returns null for them, and the
  // day that changes the card changes with it. Any copy that enumerates metrics is
  // therefore wrong on a schedule nobody controls.
  //
  // DO NOT ADD A REPLACEMENT. Not a shorter list, not an info affordance. scanIntro
  // already explains the feature, so there is nothing left for one to reveal, and a
  // list behind a tap goes stale exactly as fast as a list in the open.
~~~~

Now reads:

~~~~
// ONE LINE, NOT TWO. scanDetail is GONE and scanIntro stays
  // verbatim. The distinction that killed the second line:
  //
  //   scanIntro says what the scan DOES. That is stable.
  //   scanDetail said what she GETS. That is not, and it went stale.
  //
  // It named three metrics while the results card shows four. Two more are requested
  // and stored but not displayed, because the licence returns null for them, and the
  // day that changes the card changes with it. Any copy that enumerates metrics is
  // therefore wrong on a schedule nobody controls.
  //
  // DO NOT ADD A REPLACEMENT. Not a shorter list, not an info affordance. scanIntro
  // already explains the feature, so there is nothing left for one to reveal, and a
  // list behind a tap goes stale exactly as fast as a list in the open.
~~~~

### dashboard.html:11134 (stripped, js-line)

~~~~
// SANA_CONSENT_V3 — counsel's data-flow language, adapted to the copy rules
  // (no em dashes, no colons in body copy, short plain sentences).
  //
  // BOTH GATES STAY FALSE. Pasting the text is not approving it:
  // SANA_CONSENT_TEXT_APPROVED is still false here, and every v3 notice in the
  // server's consent-versions.ts still carries approved:false, so the stamp
  // endpoint refuses a grant. The text is in place so the switch-on review reads
  // the real notice instead of a placeholder.
  //
  // The second sentence describes retention that is TRUE ONLY ONCE the erase
  // adapter and the thread reaper are armed. Both are listed as pre-
  // SANA_CHAT_ENABLED gates in backend-branches docs/switch-on-agenda-2026-09-01.md.
  // Flipping SANA_CHAT_ENABLED before they arm would make this sentence a false
  // promise, which is worse than no sentence at all.
~~~~

Now reads:

~~~~
// SANA_CONSENT_V3 — data-flow language, adapted to the copy rules
  // (no em dashes, no colons in body copy, short plain sentences).
  //
  // BOTH GATES STAY FALSE. Pasting the text is not approving it:
  // `SANA_CONSENT_TEXT_APPROVED` is still false here, and every v3 notice in the
  // server's consent-versions.ts still carries `approved:false`, so the stamp
  // endpoint refuses a grant. The text is in place so the switch-on review reads
  // the real notice instead of a placeholder.
  //
  // The second sentence describes retention that is TRUE ONLY ONCE the erase
  // adapter and the thread reaper are armed. Both are listed as pre-
  // SANA_CHAT_ENABLED gates in backend-branches docs/switch-on-agenda-2026-09-01.md.
  // Flipping SANA_CHAT_ENABLED before they arm would make this sentence a false
  // promise, which is worse than no sentence at all.
~~~~

### dashboard.html:11149 (stripped, js-line)

~~~~
// COUNSEL-APPROVED v3.1, verbatim. sha256 9a01eab1091ff0b1add8c5b625f1a73d3d9dfe81b60358bfa9e7c1f0376aec0d.
  // THIS STRING IS THE CONSENT RECORD. consent-accept derives notice_sha256 from ITS OWN copy of
  // this text, so any drift here means consent_events certifies wording the user never read.
  // scripts/test-consent-gate.mjs hashes the rendered card and fails on a single character.
~~~~

Now reads:

~~~~
// v3.1, verbatim. sha256 `9a01eab1091ff0b1add8c5b625f1a73d3d9dfe81b60358bfa9e7c1f0376aec0d`.
  // THIS STRING IS THE CONSENT RECORD. consent-accept derives notice_sha256 from ITS OWN copy of
  // this text, so any drift here means consent_events certifies wording the user never read.
  // scripts/test-consent-gate.mjs hashes the rendered card and fails on a single character.
~~~~

### dashboard.html:11171 (stripped, js-line)

~~~~
// SANA_CONSENT_TEXT_APPROVED — the CLIENT half of a two-layer gate.
//
// The server half is `approved: false` on every v3 notice in
// supabase/functions/process-report-worker/consent-versions.ts, which makes the
// stamp endpoint refuse a grant outright. This constant makes the client refuse
// to ASK. Both must flip, in the commit that pastes the counsel-approved text.
//
// It is a SEPARATE constant from SANA_CHAT_ENABLED on purpose. That flag guards
// whether the chat is visible; this one guards whether a legal artifact can be
// created. One flag guarding two unrelated risks is how the wrong one gets
// flipped.
~~~~

Now reads:

~~~~
// `SANA_CONSENT_TEXT_APPROVED` — the CLIENT half of a two-layer gate.
//
// The server half is `approved: false` on every v3 notice in
// supabase/functions/process-report-worker/consent-versions.ts, which makes the
// stamp endpoint refuse a grant outright. This constant makes the client refuse
// to ASK. Both must flip, in the commit that pastes the text.
//
// It is a SEPARATE constant from SANA_CHAT_ENABLED on purpose. That flag guards
// whether the chat is visible; this one guards whether a legal artifact can be
// created. One flag guarding two unrelated risks is how the wrong one gets
// flipped.
~~~~

### dashboard.html:11185 (stripped, js-line)

~~~~
// CONSENT_V2_V4_DARK — Sana consent v4, built DARK. While SANA_CONSENT_V4_ENABLED is false the
// card shows consentBody (v3.1) and v3.1 is what is sent, exactly as before.
//
// SANA_CONSENT_V4_TEXT is the server's sana v4 notice VERBATIM (supa consent-versions.ts, sha256
// 98e8c45ca85d7ef334675584464cfb02fd0b25babeb0cba26486f2087e39d640). When the flag is on it is the
// card body, v4 is the version sent, and sanaConsentGranted reads the VERSION as well as the
// action, so a woman whose latest Sana grant is v3.1 is asked again before she chats. The server
// refuses a v4 grant until counsel approves it (approved:false).
// SWITCHED ON 2026-09-24, controls.md flip step 3, after counsel's reply C approved Sana v4 and
// consent-accept v9 began accepting it. The paragraph above describes the dark build.
~~~~

Now reads:

~~~~
// CONSENT_V2_V4_DARK — Sana consent v4, built DARK. While SANA_CONSENT_V4_ENABLED is false the
// card shows consentBody (v3.1) and v3.1 is what is sent, exactly as before.
//
// SANA_CONSENT_V4_TEXT is the server's sana v4 notice VERBATIM (supa consent-versions.ts, sha256
// `98e8c45ca85d7ef334675584464cfb02fd0b25babeb0cba26486f2087e39d640`). When the flag is on it is the
// card body, v4 is the version sent, and sanaConsentGranted reads the VERSION as well as the
// action, so a woman whose latest Sana grant is v3.1 is asked again before she chats. The server
// refuses a v4 grant (`approved:false`).
// SWITCHED ON, controls.md flip step 3, after
// consent-accept v9 began accepting it. The paragraph above describes the dark build.
~~~~

### dashboard.html:11291 (stripped, js-line)

~~~~
// SANA_RENDER_V1 — lifted verbatim from mocks/sana-thread.html, which is the
// approved spec. The live render was '<p>' + esc(answer) + '</p>', a single
// escaped paragraph, so every asterisk and hyphen the model emitted appeared
// literally on screen.
//
// ESCAPE FIRST, then apply a CLOSED SET of marks. No headings, no links, no raw
// HTML: everything the model emits is text until this function decides
// otherwise, which is why the escape runs before anything else and never after.
//
// SANA_EM_DASH_V1 — the em-dash strip is the ONE thing that runs before the
// escape, and it must. esc() (the page-wide escaper) applies exactly these two
// replaces to the RAW string and then entity-encodes; running them here in the
// same order on the same raw input is what makes the two paths provably agree
// rather than merely look similar. It does not weaken the rule above: these are
// text->text substitutions whose outputs (", " and "-") carry no HTML-special
// character, so everything they produce is still escaped by the line below.
// Doing it the other way round -- mutating already-escaped text -- is the unsafe
// direction, because a future replacement containing & or < would land in the
// markup unescaped, past the only escape this function performs.
~~~~

Now reads:

~~~~
// SANA_RENDER_V1 — lifted verbatim from mocks/sana-thread.html, which is the
// spec. The live render was '<p>' + esc(answer) + '</p>', a single
// escaped paragraph, so every asterisk and hyphen the model emitted appeared
// literally on screen.
//
// ESCAPE FIRST, then apply a CLOSED SET of marks. No headings, no links, no raw
// HTML: everything the model emits is text until this function decides
// otherwise, which is why the escape runs before anything else and never after.
//
// SANA_EM_DASH_V1 — the em-dash strip is the ONE thing that runs before the
// escape, and it must. esc() (the page-wide escaper) applies exactly these two
// replaces to the RAW string and then entity-encodes; running them here in the
// same order on the same raw input is what makes the two paths provably agree
// rather than merely look similar. It does not weaken the rule above: these are
// text->text substitutions whose outputs (", " and "-") carry no HTML-special
// character, so everything they produce is still escaped by the line below.
// Doing it the other way round -- mutating already-escaped text -- is the unsafe
// direction, because a future replacement containing & or < would land in the
// markup unescaped, past the only escape this function performs.
~~~~

### dashboard.html:11435 (stripped, js-line)

~~~~
// FACE_SCAN_ENTRY_V1 — the one-tap authenticated hand-off to the scan page.
//
// THE MECHANISM, ratified: a one-time Supabase access token in the URL FRAGMENT,
// assembled at click time and handed straight to window.open. A fragment is never
// sent to a server, so it appears in no request line and no access log. The scan
// page reads it once in a classic head script and strips it with
// history.replaceState before anything else runs.
//
// NOOPENER IS KEPT ON PURPOSE. It is what makes window.opener null on the far
// side, and scan.biowellth.ai serves COOP same-origin, so there is no handle to
// postMessage through in either direction. The fragment is not a workaround for
// the missing channel -- it is the consequence of a boundary we want, and
// dropping noopener to get a channel back would hand the scan page a live
// reference to this tab. A second login on scan.biowellth.ai was rejected
// separately, as a second auth surface for the same woman.
//
// THE TOKEN IS NEVER PERSISTED AND NEVER RENDERED. It lives in two local consts
// for the length of this call and nowhere else: no element, no data attribute, no
// localStorage, no sessionStorage, no cookie, no console. Both consts die with
// the call frame, so nothing retains the URL after window.open returns.
//
// NOT WIRED TO A CONTROL YET, deliberately. A visible entry point needs a label
// and a line saying it uses the camera, and this repo has no scan or camera copy
// at all. Writing that copy here would put unreviewed user-facing words on the
// dashboard, so the mechanism ships gated and tested and the copy is a separate
// ruling. One call site is all that remains.
~~~~

Now reads:

~~~~
// FACE_SCAN_ENTRY_V1 — the one-tap authenticated hand-off to the scan page.
//
// THE MECHANISM: a one-time Supabase access token in the URL FRAGMENT,
// assembled at click time and handed straight to window.open. A fragment is never
// sent to a server, so it appears in no request line and no access log. The scan
// page reads it once in a classic head script and strips it with
// history.replaceState before anything else runs.
//
// NOOPENER IS KEPT ON PURPOSE. It is what makes window.opener null on the far
// side, and scan.biowellth.ai serves COOP same-origin, so there is no handle to
// postMessage through in either direction. The fragment is not a workaround for
// the missing channel -- it is the consequence of a boundary we want, and
// dropping noopener to get a channel back would hand the scan page a live
// reference to this tab. A second login on scan.biowellth.ai was rejected
// separately, as a second auth surface for the same woman.
//
// THE TOKEN IS NEVER PERSISTED AND NEVER RENDERED. It lives in two local consts
// for the length of this call and nowhere else: no element, no data attribute, no
// localStorage, no sessionStorage, no cookie, no console. Both consts die with
// the call frame, so nothing retains the URL after window.open returns.
//
// NOT WIRED TO A CONTROL YET, deliberately. A visible entry point needs a label
// and a line saying it uses the camera, and this repo has no scan or camera copy
// at all. Writing that copy here would put unreviewed user-facing words on the
// dashboard, so the mechanism ships gated and tested.
// One call site is all that remains.
~~~~

### dashboard.html:11509 (stripped, js-line)

~~~~
// SCAN_CHIP_CONSENT_V1. The consent flow for a face scan tap, the same one sanaSend runs.
//
// THE DEFECT. The scan chip, labelled SANA_COPY.scanLabel.action (CAMERA_READING_CHIP_V1), renders for every woman,
// because renderCompanionChips prepends it with no gate, and openFaceScan's first line returned
// false when there was no Sana consent. So a woman who had never agreed tapped the chip and
// nothing happened at all: no card, no note, no navigation. Measured on production by an
// account with zero sana consent_events.
//
// WHY HERE AND NOT IN THE CHIP. renderCompanionChips's chip assembly and click handler are
// pinned line for line by scripts/test-scan-handoff.mjs, so the chip stays exactly as it is and
// the tap it already makes now leads somewhere. Kept out of openFaceScan's own body too, which
// that suite also pins for string literals and DOM sinks.
//
// THE SAME FLOW AS sanaSend, with its own strings only: consentPending while the notice is not
// approved, the consent card from sanaAskConsent, and consentDeclined on a no. No new copy.
//
// THE CARD IS SCROLLED INTO VIEW. It mounts in #sana-consent, at the foot of the companion card,
// below the chat, while the chip sits at the top of it. On a phone that is below the fold, so a
// woman who tapped the chip would see nothing change. Centred, and without animation when she
// prefers reduced motion. Nothing in the markup moves.
//
// renderScanEntry IS NOT CALLED HERE. sanaAskConsent already calls it the moment a grant is
// stamped (SCAN_AFTER_CONSENT_V1), so the card and the top bar link appear on a yes without a
// second call.
~~~~

Now reads:

~~~~
// SCAN_CHIP_CONSENT_V1. The consent flow for a face scan tap, the same one sanaSend runs.
//
// THE DEFECT. The scan chip, labelled SANA_COPY.scanLabel.action (CAMERA_READING_CHIP_V1), renders for every woman,
// because renderCompanionChips prepends it with no gate, and openFaceScan's first line returned
// false when there was no Sana consent. So a woman who had never agreed tapped the chip and
// nothing happened at all: no card, no note, no navigation. Measured on production by an
// account with zero sana consent_events.
//
// WHY HERE AND NOT IN THE CHIP. renderCompanionChips's chip assembly and click handler are
// pinned line for line by scripts/test-scan-handoff.mjs, so the chip stays exactly as it is and
// the tap it already makes now leads somewhere. Kept out of openFaceScan's own body too, which
// that suite also pins for string literals and DOM sinks.
//
// THE SAME FLOW AS sanaSend, with its own strings only: consentPending while the notice is not
// `approved`, the consent card from sanaAskConsent, and consentDeclined on a no. No new copy.
//
// THE CARD IS SCROLLED INTO VIEW. It mounts in #sana-consent, at the foot of the companion card,
// below the chat, while the chip sits at the top of it. On a phone that is below the fold, so a
// woman who tapped the chip would see nothing change. Centred, and without animation when she
// prefers reduced motion. Nothing in the markup moves.
//
// renderScanEntry IS NOT CALLED HERE. sanaAskConsent already calls it the moment a grant is
// stamped (SCAN_AFTER_CONSENT_V1), so the card and the top bar link appear on a yes without a
// second call.
~~~~

### dashboard.html:11586 (stripped, js-line)

~~~~
// SCAN_SAME_TAB_ON_PHONE_V1. On a phone the open above never happened.
  //
  // iOS Safari grants a window.open only while the user activation from the tap is still
  // live, and it does not survive an await. Two sit above this line, sanaConsentGranted and
  // sanaAccessToken, so by the time we asked for a window the activation was gone and Safari
  // refused it silently. The founder tapped the scan button on her phone and nothing
  // happened at all, which is the worst shape a failure can take: no window, no error, no
  // way to tell a blocked popup from a dead button.
  //
  // Same tab is the fix rather than a workaround. The scan page is a full screen camera flow
  // that wants the whole viewport anyway, and it now carries its own "Back to your dashboard"
  // link, shipped 2026-09-22, so leaving this tab is no longer a one way trip. Without that
  // link this branch would strand her, which is why it went first.
  //
  // COARSE POINTER OR A NARROW VIEWPORT, not a user agent string. A touch device is the thing
  // that actually blocks the popup, and pointer coarse is how the platform says so; the width
  // test is the fallback for a browser that does not answer the media query. There was no
  // device check in this file before this line, so nothing existing could be reused.
  //
  // THE DESKTOP PATH IS UNTOUCHED, byte for byte. A second window is right on a desktop, where
  // the dashboard stays visible beside it and noopener still severs the handle both ways.
~~~~

Now reads:

~~~~
// SCAN_SAME_TAB_ON_PHONE_V1. On a phone the open above never happened.
  //
  // iOS Safari grants a window.open only while the user activation from the tap is still
  // live, and it does not survive an await. Two sit above this line, sanaConsentGranted and
  // sanaAccessToken, so by the time we asked for a window the activation was gone and Safari
  // refused it silently. Nothing
  // happened at all, which is the worst shape a failure can take: no window, no error, no
  // way to tell a blocked popup from a dead button.
  //
  // Same tab is the fix rather than a workaround. The scan page is a full screen camera flow
  // that wants the whole viewport anyway, and it now carries its own "Back to your dashboard"
  // link, shipped 2026-09-22, so leaving this tab is no longer a one way trip. Without that
  // link this branch would strand her, which is why it went first.
  //
  // COARSE POINTER OR A NARROW VIEWPORT, not a user agent string. A touch device is the thing
  // that actually blocks the popup, and pointer coarse is how the platform says so; the width
  // test is the fallback for a browser that does not answer the media query. There was no
  // device check in this file before this line, so nothing existing could be reused.
  //
  // THE DESKTOP PATH IS UNTOUCHED, byte for byte. A second window is right on a desktop, where
  // the dashboard stays visible beside it and noopener still severs the handle both ways.
~~~~

### dashboard.html:11662 (stripped, js-line)

~~~~
// ONE poster for every consent event this page creates, grant and withdrawal
// alike, so there is a single place the approval gate is applied and a single
// request shape to keep correct.
//
// THE APPROVAL GATE COVERS GRANTS ONLY. Refusing to record a withdrawal because
// the notice text is still with counsel would trap a user inside a consent she
// wants out of, which is the opposite of what the gate is for. The server takes
// the same position in handleV3.
//
// CONSENT_V2_V4_DARK: the VERSION is the caller's, chosen by consentVersionFor(type). It used to be
// SANA_CONSENT_VERSION for every type, which is the core-withdrawal defect described there.
~~~~

Now reads:

~~~~
// ONE poster for every consent event this page creates, grant and withdrawal
// alike, so there is a single place the gate is applied and a single
// request shape to keep correct.
//
// THE GATE COVERS GRANTS ONLY. Refusing to record a withdrawal would trap a user inside a consent she
// wants out of, which is the opposite of what the gate is for. The server takes
// the same position in handleV3.
//
// CONSENT_V2_V4_DARK: the VERSION is the caller's, chosen by consentVersionFor(type). It used to be
// SANA_CONSENT_VERSION for every type, which is the core-withdrawal defect described there.
~~~~

### dashboard.html:11762 (stripped, js-line)

~~~~
// The notice is still with counsel. Say so plainly rather than showing a
      // placeholder or failing silently.
~~~~

Now reads:

~~~~
// The notice is still pending. Say so plainly rather than showing a
      // placeholder or failing silently.
~~~~

### dashboard.html:11991 (stripped, js-line)

~~~~
// Rail "Browse everything" nav card. Three rows, each OPENING its own overlay page: markers
// (all-markers view), themes (the by-theme page), gaps ("what to test next"). Each row is gated
// on DATA PRESENCE
//
// THIS SAID "systems (body map), markers, gaps" and was STALE: the systems row had already moved
// out to its own renderRailSystems card, leaving two rows behind a comment that claimed three.
// It is three again as of 2026-09-23, for a different reason, which is exactly why the list is
// spelled out rather than just counted.
// in the payload (systems.length / markerCountOf / RD_GAPS_SHOWN), not section visibility. No live
// rows -> the card hides.
~~~~

Now reads:

~~~~
// Rail "Browse everything" nav card. Three rows, each OPENING its own overlay page: markers
// (all-markers view), themes (the by-theme page), gaps ("what to test next"). Each row is gated
// on DATA PRESENCE
// in the payload (systems.length / markerCountOf / RD_GAPS_SHOWN), not section visibility. No live
// rows -> the card hides.
~~~~

### dashboard.html:12148 (stripped, js-line)

~~~~
// THEME_LINE — authored per-direction copy, GENERATED from docs/THEME_MARKER_LINE-consolidated.md
// at b010237 by tools gen_theme_line.py. 113 markers / 170 direction entries. DO NOT hand-edit;
// re-run the generator against the doc. Keys are canonical marker_ids; values carry high and/or low.
~~~~

Now reads:

~~~~
// THEME_LINE — authored per-direction copy, GENERATED from docs/THEME_MARKER_LINE-consolidated.md
// by tools gen_theme_line.py. 113 markers / 170 direction entries. DO NOT hand-edit;
// re-run the generator against the doc. Keys are canonical marker_ids; values carry high and/or low.
~~~~

### dashboard.html:12394 (stripped, js-line)

~~~~
// Gather this theme's markers straight from systems[].markers[], bucketed by ENGINE status through
  // the SAME filter renderThemeGrid's tally uses (skip sensitive systems -> themesOf membership ->
  // sysStatus(status).cls), so the tier counts reconcile with the card's count line by construction.
  // The model's severity/flag_status are never read on this surface.
  // P0_SAFETY_SETS_V1 — DIVERGES DELIBERATELY, reconciliation DEFERRED. This is the only safety set
  // carrying "genetic". Whether genetic findings belong under the same render-suppression rule is a
  // clinical question that was NOT settled in the 2026-08-25 pass, so the set is left exactly as it
  // was rather than quietly widened. Do not "tidy" this into SENSITIVE_SYSTEMS without that ruling.
~~~~

Now reads:

~~~~
// Gather this theme's markers straight from systems[].markers[], bucketed by ENGINE status through
  // the SAME filter renderThemeGrid's tally uses (skip sensitive systems -> themesOf membership ->
  // sysStatus(status).cls), so the tier counts reconcile with the card's count line by construction.
  // The model's severity/flag_status are never read on this surface.
  // P0_SAFETY_SETS_V1 — DIVERGES DELIBERATELY, reconciliation DEFERRED. This is the only safety set
  // carrying "genetic". Whether genetic findings belong under the same render-suppression rule is a
  // clinical question that was NOT settled, so the set is left exactly as it
  // was rather than quietly widened. Do not "tidy" this into SENSITIVE_SYSTEMS.
~~~~

### dashboard.html:12415 (stripped, js-line)

~~~~
// RULED 2026-09-21: a marker whose status is in REPORT_NOT_SCORED_STATUS is NEVER counted
      // or shown as in range. It leaves the good group and the in-range count entirely.
      //
      // Tested BEFORE the class buckets because that is the only place it can be caught here.
      // Every unscored status resolves to s-none or s-ref -- measured, all seven -- and the
      // `else` below is a catch-all, so it swept every one of them into `good` and TIER 3
      // rendered them under "In range" with a teal chip. The sibling counters elsewhere on the
      // page test `cls === "s-good"` and were never exposed to this; this one tested nothing.
      //
      // Live on real data when it was found: 265 such markers across 21 reports and 15 owners.
      // supplement_high is a REAL reading that is high -- a water-soluble vitamin running above
      // range because she is supplementing. It is not unread, so it does not belong in the
      // "N not scored." count, and it is certainly not in range. It goes with watch. Tested
      // BEFORE the unscored divert because it is a member of REPORT_NOT_SCORED_STATUS (that set
      // governs whether a marker was scored against a functional range, which this was not) and
      // the divert would otherwise claim it.
~~~~

Now reads:

~~~~
// A marker whose status is in REPORT_NOT_SCORED_STATUS is NEVER counted
      // or shown as in range. It leaves the good group and the in-range count entirely.
      //
      // Tested BEFORE the class buckets because that is the only place it can be caught here.
      // Every unscored status resolves to s-none or s-ref -- measured, all seven -- and the
      // `else` below is a catch-all, so it swept every one of them into `good` and TIER 3
      // rendered them under "In range" with a teal chip. The sibling counters elsewhere on the
      // page test `cls === "s-good"` and were never exposed to this; this one tested nothing.
      //
      // Live on real data when it was found: 265 such markers across 21 reports and 15 owners.
      // supplement_high is a REAL reading that is high -- a water-soluble vitamin running above
      // range because she is supplementing. It is not unread, so it does not belong in the
      // "N not scored." count, and it is certainly not in range. It goes with watch. Tested
      // BEFORE the unscored divert because it is a member of REPORT_NOT_SCORED_STATUS (that set
      // governs whether a marker was scored against a functional range, which this was not) and
      // the divert would otherwise claim it.
~~~~

### dashboard.html:12480 (stripped, js-line)

~~~~
// RULED 2026-09-21: one grey line when this theme carries unscored markers, verbatim
  //   N not scored.
  // No teal, no amber, no chip, no names. We did not read these results, so the line reports
  // the count and nothing else -- it must not read as reassurance OR as a warning. .mk-note is
  // the existing grey note class (--brown-mid), the same one the unknown_unit marker row uses.
  // A count of 1 renders "1 not scored." from the same expression; no pluralisation needed.
~~~~

Now reads:

~~~~
// One grey line when this theme carries unscored markers, verbatim
  //   N not scored.
  // No teal, no amber, no chip, no names. We did not read these results, so the line reports
  // the count and nothing else -- it must not read as reassurance OR as a warning. .mk-note is
  // the existing grey note class (--brown-mid), the same one the unknown_unit marker row uses.
  // A count of 1 renders "1 not scored." from the same expression; no pluralisation needed.
~~~~

### dashboard.html:12500 (stripped, js-line)

~~~~
// Inline healthy range for a row, from lookupRange ONLY. Returns "" when RANGES_LOOKUP is not
// loaded (lookupRange -> null) or the marker has no range — never a placeholder.
// Directional "Healthy ..." copy from a {low, high} ref. Direction comes ONLY from which bound is
// populated: both -> "X to Y"; high only -> "below Y" (a ceiling, do-not-exceed); low only ->
// "above X" (a floor, at-least); neither -> "". This is the SINGLE source of the string — the old
// undirected form (join both non-null bounds with " to ") printed a lone ceiling as "Healthy 20",
// reading a limit as a target. It survived because the string was duplicated across two call sites
// (inlineRange + markerDetailHTML); keep it in one place so they can never diverge again. Display
// only — never infers direction from marker id, system, or status.
// MARKER_BAND_V1 — the position band. A track whose ends are the functional range and a dot at
// her value. It is scoped to exactly where healthyRangeText already renders, so it introduces no
// coverage gap that the range text does not already have: same lookupRange, same ranges-slim,
// same markers.
//
// DRAWN ONLY WITH BOTH BOUNDS AND A NUMERIC VALUE. Measured on the current panel, 95 of 169
// markers carry two bounds, 55 carry one and 19 carry none, and regenerating ranges-slim.json
// does not move that -- the ceiling is in the library's own range strings. A one-ended range
// cannot place a dot on a track, and half a track invites the reader to infer the missing end.
// One bound or none renders exactly what renders today: the range sentence, no band.
//
// NO VERDICT ANYWHERE, and this is the whole design constraint rather than a detail. The track
// carries the two numbers and the words "functional range"; the dot carries her value. There is
// no colour that encodes good or bad and no status word in any label -- a band that turned red
// would be the engine's verdict restated by a decoration, which is the one thing the display
// layer must never do. Both ends use the same neutral tone for the same reason.
//
// THE CLAMP IS 4% AT EACH END. A value far outside the range would otherwise sit at a negative
// or >100% offset and vanish off the track, which reads as "no data" rather than "well outside".
// Clamping to [4, 96] keeps the dot visible and hard against the end it exceeded, so the
// direction is still legible from position alone without a word for it.
//
// ARIA-HIDDEN. The band restates, in a picture, two facts already present as text on this card:
// the value, in the status chip on the card face, and the range, in the .prio-mk-range sentence
// beside this very track. A screen reader that announced the track as well would hear the same
// numbers twice, so it is marked decorative.
// MARKER_BAND_V2 — THE AXIS COMES FROM THE CONVENTIONAL INTERVAL, NEVER FROM HER VALUE.
//
// V1 spanned the functional range and clamped anything outside it. That is why it failed: for any
// value below the functional low the clamp is the only thing deciding position, so every such
// marker landed on the same floor. MEASURED on the panel the defect was reported from, before this
// was written: 11 of 16 drawn markers sat on the identical 4.00% floor and the whole card carried
// 5 distinct dot positions. Under this axis the same 16 markers take 16 distinct positions.
//
// AN AXIS DERIVED FROM HER VALUE CANNOT SEPARATE TWO WOMEN, which is the general form of that bug
// and the reason the rule is absolute rather than a preference: if v appears in the axis bounds
// then pos(v) is a function of the padding alone and is the same number for everyone below range.
// So axis_lo and axis_hi are built from conv and f ONLY. If you ever need to widen the track for
// an extreme value, widen it from the library, not from the reading.
//
// ONE ZONE, GREEN, THE FUNCTIONAL RANGE. Everything outside it is the neutral track. There is no
// amber and no coral: amber is deferred, and a second coloured region would be the engine's
// verdict restated by a decoration, which is the thing the display layer must not do. The track
// carries no caption, so no word sits on it to be read as a judgement.
//
// FALLBACK TO NO TRACK, and these four are the only conditions. Each returns "" and the caller
// renders the value alone, which is what a marker with no functional range already does:
//   1. conventional interval not two-ended    2. functional range not two-ended
//   3. conv span <= 0 (the pad would vanish or invert)
//   4. the axis does not STRICTLY contain the functional range on both sides
// Measured over the 126 library rows carrying both tiers: condition 3 catches exactly one row,
// nucleated_rbc_pct, and condition 4 catches nothing that 3 has not already caught. Both are kept
// because they are different failures and a future library edit can produce one without the other.
// MARKER_BAND_V3 — THE GEOMETRY, computed once and shared. markerBandHTML renders it and
// bandContradictsEngine reads it; neither re-derives an axis of its own. V2 had the consistency
// rule rebuild the axis from the ref and parse the dot back out of the rendered HTML, which was
// correct only for as long as the two constructions stayed identical. The zero floor below breaks
// that: an axis that floors moves BOTH the dot and the zone edges, and a re-derivation that did
// not know about the floor would compare a floored dot against unfloored edges.
//
// THE FIVE SEGMENTS PARTITION THE AXIS BY CONSTRUCTION, with no gaps and no overlaps:
//   coral  axis_lo .. outer_lo        amber  outer_lo .. f_low
//   green  f_low   .. f_high
//   amber  f_high  .. outer_hi        coral  outer_hi .. axis_hi
// They are emitted from SIX BOUNDARIES rounded once, with each width taken as the difference of
// two rounded boundaries rather than a separately rounded width. Rounding the widths independently
// leaves sub-0.1% seams between neighbours that no assertion on either number alone would catch.
//
// WHERE THE CONVENTIONAL RANGE IS NARROWER THAN THE FUNCTIONAL ONE on a side, that amber segment
// has zero width and the coral runs to the green edge. That falls out of min/max; it is not
// special-cased, and a zero-width segment renders nothing.
//
// THE ZERO FLOOR. If every bound on file for the marker is >= 0 and the padded axis would start
// below zero, the axis starts at zero instead. Ferritin's axis ran to about minus 21, a tenth of
// the track spent on concentrations that cannot exist, and it squeezed green. If ANY bound on file
// is negative the floor does not apply, because then negative values are real for that marker.
// MARKER_BAND_V3 TIER 2 — THE FALLBACK AXIS for a marker with no usable conventional interval.
// RULED AT 1.0, on how the zone reads, not selected from a measurement: the separation test that
// would have chosen it is vacuous at a sample of one Tier 2 marker on one report and none on the
// other, and a criterion that cannot fail is not a criterion. One named constant, so moving it is
// one edit and one assertion.
//   pad = K * (f_high - f_low), axis = [f_low - pad, f_high + pad]
// At K = 1 the functional range is exactly one third of the axis, which is what the assertions
// compute rather than hardcode.
~~~~

Now reads:

~~~~
// Inline healthy range for a row, from lookupRange ONLY. Returns "" when RANGES_LOOKUP is not
// loaded (lookupRange -> null) or the marker has no range — never a placeholder.
// Directional "Healthy ..." copy from a {low, high} ref. Direction comes ONLY from which bound is
// populated: both -> "X to Y"; high only -> "below Y" (a ceiling, do-not-exceed); low only ->
// "above X" (a floor, at-least); neither -> "". This is the SINGLE source of the string — the old
// undirected form (join both non-null bounds with " to ") printed a lone ceiling as "Healthy 20",
// reading a limit as a target. It survived because the string was duplicated across two call sites
// (inlineRange + markerDetailHTML); keep it in one place so they can never diverge again. Display
// only — never infers direction from marker id, system, or status.
// MARKER_BAND_V1 — the position band. A track whose ends are the functional range and a dot at
// her value. It is scoped to exactly where healthyRangeText already renders, so it introduces no
// coverage gap that the range text does not already have: same lookupRange, same ranges-slim,
// same markers.
//
// DRAWN ONLY WITH BOTH BOUNDS AND A NUMERIC VALUE. Measured on the current panel, 95 of 169
// markers carry two bounds, 55 carry one and 19 carry none, and regenerating ranges-slim.json
// does not move that -- the ceiling is in the library's own range strings. A one-ended range
// cannot place a dot on a track, and half a track invites the reader to infer the missing end.
// One bound or none renders exactly what renders today: the range sentence, no band.
//
// NO VERDICT ANYWHERE, and this is the whole design constraint rather than a detail. The track
// carries the two numbers and the words "functional range"; the dot carries her value. There is
// no colour that encodes good or bad and no status word in any label -- a band that turned red
// would be the engine's verdict restated by a decoration, which is the one thing the display
// layer must never do. Both ends use the same neutral tone for the same reason.
//
// THE CLAMP IS 4% AT EACH END. A value far outside the range would otherwise sit at a negative
// or >100% offset and vanish off the track, which reads as "no data" rather than "well outside".
// Clamping to [4, 96] keeps the dot visible and hard against the end it exceeded, so the
// direction is still legible from position alone without a word for it.
//
// ARIA-HIDDEN. The band restates, in a picture, two facts already present as text on this card:
// the value, in the status chip on the card face, and the range, in the .prio-mk-range sentence
// beside this very track. A screen reader that announced the track as well would hear the same
// numbers twice, so it is marked decorative.
// MARKER_BAND_V2 — THE AXIS COMES FROM THE CONVENTIONAL INTERVAL, NEVER FROM HER VALUE.
//
// V1 spanned the functional range and clamped anything outside it. That is why it failed: for any
// value below the functional low the clamp is the only thing deciding position, so every such
// marker landed on the same floor. MEASURED on the panel the defect was reported from, before this
// was written: 11 of 16 drawn markers sat on the identical 4.00% floor and the whole card carried
// 5 distinct dot positions. Under this axis the same 16 markers take 16 distinct positions.
//
// AN AXIS DERIVED FROM HER VALUE CANNOT SEPARATE TWO WOMEN, which is the general form of that bug
// and the reason the rule is absolute rather than a preference: if v appears in the axis bounds
// then pos(v) is a function of the padding alone and is the same number for everyone below range.
// So axis_lo and axis_hi are built from conv and f ONLY. If you ever need to widen the track for
// an extreme value, widen it from the library, not from the reading.
//
// ONE ZONE, GREEN, THE FUNCTIONAL RANGE. Everything outside it is the neutral track. There is no
// amber and no coral: amber is deferred, and a second coloured region would be the engine's
// verdict restated by a decoration, which is the thing the display layer must not do. The track
// carries no caption, so no word sits on it to be read as a judgement.
//
// FALLBACK TO NO TRACK, and these four are the only conditions. Each returns "" and the caller
// renders the value alone, which is what a marker with no functional range already does:
//   1. conventional interval not two-ended    2. functional range not two-ended
//   3. conv span <= 0 (the pad would vanish or invert)
//   4. the axis does not STRICTLY contain the functional range on both sides
// Measured over the 126 library rows carrying both tiers: condition 3 catches exactly one row,
// nucleated_rbc_pct, and condition 4 catches nothing that 3 has not already caught. Both are kept
// because they are different failures and a future library edit can produce one without the other.
// MARKER_BAND_V3 — THE GEOMETRY, computed once and shared. markerBandHTML renders it and
// bandContradictsEngine reads it; neither re-derives an axis of its own. V2 had the consistency
// rule rebuild the axis from the ref and parse the dot back out of the rendered HTML, which was
// correct only for as long as the two constructions stayed identical. The zero floor below breaks
// that: an axis that floors moves BOTH the dot and the zone edges, and a re-derivation that did
// not know about the floor would compare a floored dot against unfloored edges.
//
// THE FIVE SEGMENTS PARTITION THE AXIS BY CONSTRUCTION, with no gaps and no overlaps:
//   coral  axis_lo .. outer_lo        amber  outer_lo .. f_low
//   green  f_low   .. f_high
//   amber  f_high  .. outer_hi        coral  outer_hi .. axis_hi
// They are emitted from SIX BOUNDARIES rounded once, with each width taken as the difference of
// two rounded boundaries rather than a separately rounded width. Rounding the widths independently
// leaves sub-0.1% seams between neighbours that no assertion on either number alone would catch.
//
// WHERE THE CONVENTIONAL RANGE IS NARROWER THAN THE FUNCTIONAL ONE on a side, that amber segment
// has zero width and the coral runs to the green edge. That falls out of min/max; it is not
// special-cased, and a zero-width segment renders nothing.
//
// THE ZERO FLOOR. If every bound on file for the marker is >= 0 and the padded axis would start
// below zero, the axis starts at zero instead. Ferritin's axis ran to about minus 21, a tenth of
// the track spent on concentrations that cannot exist, and it squeezed green. If ANY bound on file
// is negative the floor does not apply, because then negative values are real for that marker.
// MARKER_BAND_V3 TIER 2 — THE FALLBACK AXIS for a marker with no usable conventional interval.
// SET AT 1.0, on how the zone reads, not selected from a measurement: the separation test that
// would have chosen it is vacuous at a sample of one Tier 2 marker on one report and none on the
// other, and a criterion that cannot fail is not a criterion. One named constant, so moving it is
// one edit and one assertion.
//   pad = K * (f_high - f_low), axis = [f_low - pad, f_high + pad]
// At K = 1 the functional range is exactly one third of the axis, which is what the assertions
// compute rather than hardcode.
~~~~

### dashboard.html:12704 (stripped, js-line)

~~~~
// MARKER_BAND_V3 — THE ZONE NOTE, one line beneath each track in that zone's ink. Ruled copy,
// verbatim, no colons and American spelling. "Your lab" appears nowhere and must not: these are
// our library's conventional reference range, not the interval printed on her report, and the two
// differ. The note is keyed on g.zone, which is read off the SAME dot-against-green comparison the
// consistency rule uses, so the words under the picture cannot disagree with the picture.
~~~~

Now reads:

~~~~
// MARKER_BAND_V3 — THE ZONE NOTE, one line beneath each track in that zone's ink. Verbatim,
// no colons and American spelling. "Your lab" appears nowhere and must not: these are
// our library's conventional reference range, not the interval printed on her report, and the two
// differ. The note is keyed on g.zone, which is read off the SAME dot-against-green comparison the
// consistency rule uses, so the words under the picture cannot disagree with the picture.
~~~~

### dashboard.html:12725 (stripped, js-line)

~~~~
// THE LEGEND, ONCE PER CARD, never per row. Three items, ruled copy.
~~~~

Now reads:

~~~~
// THE LEGEND, ONCE PER CARD, never per row. Three items.
~~~~

### dashboard.html:13442 (stripped, js-line)

~~~~
// ── HERO_TRAJ_V1 ──────────────────────────────────────────────────────────────
// OFF AS OF 2026-09-23. The hero carries a band word, a headline, a vitality ring and one
// explainer button, and the trajectory strip was a fifth thing competing with them above
// the fold. Turning it off is a layout decision, not a verdict on the drawing.
//
// A FLAG AND NOT A DELETION, deliberately. The strip is ~400 lines with its own model,
// geometry, observers and 149 assertions behind it, and every one of those still runs.
// Deleting it would throw that away to save bytes nobody is short of; flipping one
// constant gives it back. The suite pins BOTH states, so the off path and the on path are
// each proven rather than one being assumed from the other.
//
// IT RETURNS BEFORE ANY WORK. Not after the model, not after the SVG. The host ends in
// exactly the state SINGLE_PANEL_HIDDEN_V1 leaves it in -- emptied and hidden -- because
// that is the state the rest of the page already knows how to live beside.
~~~~

Now reads:

~~~~
// ── HERO_TRAJ_V1 ──────────────────────────────────────────────────────────────
// OFF. The hero carries a band word, a headline, a vitality ring and one
// explainer button, and the trajectory strip was a fifth thing competing with them above
// the fold. Turning it off is a layout decision, not a verdict on the drawing.
//
// A FLAG AND NOT A DELETION, deliberately. The strip is ~400 lines with its own model,
// geometry, observers and 149 assertions behind it, and every one of those still runs.
// Deleting it would throw that away to save bytes nobody is short of; flipping one
// constant gives it back. The suite pins BOTH states, so the off path and the on path are
// each proven rather than one being assumed from the other.
//
// IT RETURNS BEFORE ANY WORK. Not after the model, not after the SVG. The host ends in
// exactly the state SINGLE_PANEL_HIDDEN_V1 leaves it in -- emptied and hidden -- because
// that is the state the rest of the page already knows how to live beside.
~~~~

### dashboard.html:13624 (stripped, js-line)

~~~~
// DORMANT as of SINGLE_PANEL_HIDDEN_V1: renderHeroTrajectory hides the strip on a single panel, so
  // nothing reaches this branch today. Kept intact pending a decision on what occupies that space.
  // ── FIRST-PANEL WELL. Approved mock, and a different drawing from the multi-panel plot
  // rather than the same one with the lines removed. There is no y axis here because there
  // is nothing to measure against yet: one panel means every marker is 0% from itself, so a
  // height would encode nothing. Rows carry the markers, the dashed run carries the wait, and
  // the empty ring is the reading she has not taken. NO FAINT MARKS AT ALL: with no line to
  // anchor them a dozen grey dots are noise, and the three that matter are the priorities.
~~~~

Now reads:

~~~~
// DORMANT as of SINGLE_PANEL_HIDDEN_V1: renderHeroTrajectory hides the strip on a single panel, so
  // nothing reaches this branch today. Kept intact pending a decision on what occupies that space.
  // ── FIRST-PANEL WELL. A different drawing from the multi-panel plot
  // rather than the same one with the lines removed. There is no y axis here because there
  // is nothing to measure against yet: one panel means every marker is 0% from itself, so a
  // height would encode nothing. Rows carry the markers, the dashed run carries the wait, and
  // the empty ring is the reading she has not taken. NO FAINT MARKS AT ALL: with no line to
  // anchor them a dozen grey dots are noise, and the three that matter are the priorities.
~~~~

### dashboard.html:14025 (stripped, js-line)

~~~~
// Lipid markers deliberately OMITTED (ldl / non_hdl / total cholesterol, apolipoprotein_b,
  // apolipoprotein_a1, triglycerides). Framing high cholesterol as downstream of inflammation is a
  // causal cluster claim, advisor-gated; stating it as a bare hero finding reads as a verdict we have
  // not earned. A lipid-driven priority falls through the no-match path (absence from this table IS
  // the exclusion) and the next eligible priority takes the slot. The priority card below still
  // carries it in full. Revisit when the cluster rules are signed.
~~~~

Now reads:

~~~~
// Lipid markers deliberately OMITTED (ldl / non_hdl / total cholesterol, apolipoprotein_b,
  // apolipoprotein_a1, triglycerides). Framing high cholesterol as downstream of inflammation is a
  // causal cluster claim; stating it as a bare hero finding reads as a verdict we have
  // not earned. A lipid-driven priority falls through the no-match path (absence from this table IS
  // the exclusion) and the next eligible priority takes the slot. The priority card below still
  // carries it in full.
~~~~

### dashboard.html:14560 (stripped, js-line)

~~~~
// RULED COPY 2026-09-21. "Not scored." is the label; the sentence that follows is the
  // explanation. It says NOTHING about whether her result is good or bad, because we did not
  // read it -- so it stays in .mk-note (grey, --brown-mid) and must never take an amber or
  // coral class. The previous wording explained our reference table; this one explains what
  // happened to HER result, which is the only part she can do anything about.
  //
  // Double-quoted JS string, attribute quotes escaped: the single-quoted form would need
  // \' for the apostrophe and that backslash would land in the served bytes.
~~~~

Now reads:

~~~~
// "Not scored." is the label; the sentence that follows is the
  // explanation. It says NOTHING about whether her result is good or bad, because we did not
  // read it -- so it stays in .mk-note (grey, --brown-mid) and must never take an amber or
  // coral class. The previous wording explained our reference table; this one explains what
  // happened to HER result, which is the only part she can do anything about.
  //
  // Double-quoted JS string, attribute quotes escaped: the single-quoted form would need
  // \' for the apostrophe and that backslash would land in the served bytes.
~~~~

### dashboard.html:14955 (stripped, js-line)

~~~~
// Beat 2: The number (ring, band, visibility) — or, on a suppressed panel, the sparse-reveal hero
  // (SIGNED) in its place. The suppressed branch drops the ring and the "This is one score for your
  // whole body" line, which would assert a score that is not there.
~~~~

Now reads:

~~~~
// Beat 2: The number (ring, band, visibility) — or, on a suppressed panel, the sparse-reveal hero
  // in its place. The suppressed branch drops the ring and the "This is one score for your
  // whole body" line, which would assert a score that is not there.
~~~~

### dashboard.html:15174 (stripped, js-line)

~~~~
// Ruled copy, verbatim. Double-quoted so the apostrophe in item 2 is never escaped -- an
    // escaped quote inside a single-quoted string has unbalanced a brace counter in this
    // codebase before, and the suite's extractor is proven against this exact string.
~~~~

Now reads:

~~~~
// Verbatim. Double-quoted so the apostrophe in item 2 is never escaped -- an
    // escaped quote inside a single-quoted string has unbalanced a brace counter in this
    // codebase before, and the suite's extractor is proven against this exact string.
~~~~

## index.html

### index.html:138 (stripped, css)

~~~~
/* OLIVE_PALETTE_V1: the approved accent is olive, replacing the earlier accent 1:1 by role.
     --olive is text and marks, --sage is fills, --sage-soft and --sage-pale are tints. */
~~~~

Now reads:

~~~~
/* OLIVE_PALETTE_V1: the accent is olive, replacing the earlier accent 1:1 by role.
     --olive is text and marks, --sage is fills, --sage-soft and --sage-pale are tints. */
~~~~

### index.html:221 (stripped, css)

~~~~
/* HERO_CARD_ROWS_V1 (2026-10-26, Aditi): max-width 228px is the middle column's live width at 1440. The longer caption
   ("What a panel skips varies by person.") would otherwise widen that column and push both cards outward; capped, it
   wraps instead and the cards keep their positions. Lifted at 1100px and below, where the caption spans the row. */
~~~~

Now reads:

~~~~
/* HERO_CARD_ROWS_V1: max-width 228px is the middle column's live width at 1440. The longer caption
   ("What a panel skips varies by person.") would otherwise widen that column and push both cards outward; capped, it
   wraps instead and the cards keep their positions. Lifted at 1100px and below, where the caption spans the row. */
~~~~

### index.html:239 (stripped, css)

~~~~
/* HERO_CARD_ROWS_V1 (2026-10-26, Aditi): the numeral layout stays. The caption now runs on two lines, the second
   ("We test them.") in semibold, a weight the page already loads (Instrument Sans 600). */
~~~~

Now reads:

~~~~
/* HERO_CARD_ROWS_V1: the numeral layout stays. The caption now runs on two lines, the second
   ("We test them.") in semibold, a weight the page already loads (Instrument Sans 600). */
~~~~

### index.html:248 (removed, css)

~~~~
/* HOME_CLEANUP_V1 (2026-10-26, Aditi): the marker ticker after the hero was removed, and its rules with it. */
~~~~

### index.html:266 (stripped, css)

~~~~
/* STACK_CARDS_MOCKUP_V1: matched to the approved mockup. The live build had drifted to cards as wide
   as .wrap (1052px at 1440) at a fixed height of min(58vh,480px), with space-between pushing the
   content to the bottom-left of a mostly empty card. Now a centred 980px column, each card
   content-driven with a 300px floor, 52px padding, 32px radius and 40px between cards. The cards
   are 980px themselves: the container carries .wrap's gutter on top of that. Sticky tops become
   120/150/180 (were 120/144/168). The GSAP stack code reads only scroll progress and sets scale and
   body opacity, never height, so no JS changed. The under-768px rule below still sets position
   relative, top auto, height auto and min-height 0, so phones keep a plain stack. */
~~~~

Now reads:

~~~~
/* STACK_CARDS_MOCKUP_V1: matched to the mockup. The live build had drifted to cards as wide
   as .wrap (1052px at 1440) at a fixed height of min(58vh,480px), with space-between pushing the
   content to the bottom-left of a mostly empty card. Now a centred 980px column, each card
   content-driven with a 300px floor, 52px padding, 32px radius and 40px between cards. The cards
   are 980px themselves: the container carries .wrap's gutter on top of that. Sticky tops become
   120/150/180 (were 120/144/168). The GSAP stack code reads only scroll progress and sets scale and
   body opacity, never height, so no JS changed. The under-768px rule below still sets position
   relative, top auto, height auto and min-height 0, so phones keep a plain stack. */
~~~~

### index.html:298 (stripped, css)

~~~~
/* LANDING_PRODUCT_SHOTS_V1: "What you get back". No glow of its own: the travelling orb and the body
   glow are the page's existing treatment, so this section adds no new decoration. The browser frame
   is 960px at 1440 and scales down with the column; the image keeps the approved 960x600 ratio. */
~~~~

Now reads:

~~~~
/* LANDING_PRODUCT_SHOTS_V1: "What you get back". No glow of its own: the travelling orb and the body
   glow are the page's existing treatment, so this section adds no new decoration. The browser frame
   is 960px at 1440 and scales down with the column; the image keeps the 960x600 ratio. */
~~~~

### index.html:313 (removed, css)

~~~~
/* HOME_CLEANUP_V1 (2026-10-26, Aditi): the second row ("See what changed, not just what is." with the trends shot)
   was removed, and the .shots-row2, .shots-trends and .shots-copy rules with it. */
~~~~

### index.html:346 (removed, css)

~~~~
/* FOUNDER */
~~~~

### index.html:375 (stripped, css)

~~~~
/* The pill stands out at rest (founder, 2026-10-24): an olive border at about 35% and a soft sage
   glow, a 4px halo plus a wider blur. color-mix() keeps it on the existing --olive and --sage, no
   new colour. A browser without color-mix() ignores those two lines and keeps the plain
   --glass-edge border. Focus stays stronger than rest: a solid olive border and ring, a brighter
   halo. The invalid state below still replaces both with coral. */
~~~~

Now reads:

~~~~
/* The pill stands out at rest: an olive border at about 35% and a soft sage
   glow, a 4px halo plus a wider blur. color-mix() keeps it on the existing --olive and --sage, no
   new colour. A browser without color-mix() ignores those two lines and keeps the plain
   --glass-edge border. Focus stays stronger than rest: a solid olive border and ring, a brighter
   halo. The invalid state below still replaces both with coral. */
~~~~

### index.html:417 (stripped, css)

~~~~
/* In the hero the error message and the link sit on the orb, not on a glass panel. Bare over the
   pearl, in the mock, the error measured 2.20:1 and the link 2.05:1 at 375px, under 4.5:1. A chip at
   the --glass the site already tunes for small text over the orb clears it (5.04:1 or better,
   re-measured live, plan section 5c). The hero used to carry the signup notice on a chip too; it
   was REMOVED from the hero by the founder on 2026-10-24 and stays under the final CTA and
   early-access forms (plan, end-of-build counsel list). The link keeps its 20px gap, now below the
   form: the 12px row gap plus its own 8px margin. Corrected 2026-10-26 by HERO_LINE_REMOVE_V1: the link
   and its line were removed from the hero, so only the error message still uses this chip here. */
~~~~

Now reads:

~~~~
/* In the hero the error message and the link sit on the orb, not on a glass panel. Bare over the
   pearl, in the mock, the error measured 2.20:1 and the link 2.05:1 at 375px, under 4.5:1. A chip at
   the --glass the site already tunes for small text over the orb clears it (5.04:1 or better,
   re-measured live, plan section 5c). The hero used to carry the signup notice on a chip too; it
   was REMOVED from the hero and stays under the final CTA and
   early-access forms. The link keeps its 20px gap, now below the
   form: the 12px row gap plus its own 8px margin. Corrected 2026-10-26 by HERO_LINE_REMOVE_V1: the link
   and its line were removed from the hero, so only the error message still uses this chip here. */
~~~~

### index.html:426 (stripped, css)

~~~~
/* HERO_LINE_REMOVE_V1: the line under the hero form ("Early access opens in small groups. How we read
   a panel", HERO_COPY_V1) was removed at Aditi's call on 2026-10-26, and with it the .wl-hero-link and
   .wl-hero-a rules, which nothing else on the site used. The science page is still one click away from
   the nav's How it works and About links. */
~~~~

Now reads:

~~~~
/* HERO_LINE_REMOVE_V1: the line under the hero form ("Early access opens in small groups. How we read
   a panel", HERO_COPY_V1) was removed, and with it the .wl-hero-link and
   .wl-hero-a rules, which nothing else on the site used. The science page is still one click away from
   the nav's How it works and About links. */
~~~~

### index.html:431 (stripped, css)

~~~~
/* WAITLIST_STEP2_V1. The optional step 2 after a successful signup (backend waitlist-signup /profile,
   migration 0077; plan docs/waitlist-step2-plan.md).
   AMENDED 2026-10-27 by founder ruling, which overrides plan sections 4 and 5: step 2 no longer
   swaps the card. The three step-1 forms behave exactly as before (done pill and all), and after
   the 200, never before, ONE shared modal opens over the page, whichever form submitted.
   Layers, bottom to top: the page (its highest layer is the nav, at 100), the veil (1000), the orb
   (1001), the dialog (1002). They are siblings rather than one wrapper on purpose: a fixed wrapper
   is a stacking context, and the page's own #orb-canvas could not then sit between the veil and the
   card. While the modal is open the live canvas is lifted to 1001, so it is the same orb, still
   animated. Where there is no live canvas (orb-static, which reduced motion also selects, or the
   early-access page, which hides it) the committed pearl.png stands in, the hero's own static orb.
   Chips: selected is ink with cream text and a cream tick, so the state is never carried by colour
   alone. NO CORAL on a chip in any state (test-waitlist-inline.mjs asserts it from computed style).
   The one coral in the modal is the italic "sooner?", in --coral-deep, the site's own heading
   italic (.display em). Labels are Instrument Sans, the live site font (founder ruling 4, no Inter). */
~~~~

Now reads:

~~~~
/* WAITLIST_STEP2_V1. The optional step 2 after a successful signup (backend waitlist-signup /profile,
   migration 0077; plan docs/waitlist-step2-plan.md).
   Step 2 no longer swaps the card.
   The three step-1 forms behave exactly as before (done pill and all), and after
   the 200, never before, ONE shared modal opens over the page, whichever form submitted.
   Layers, bottom to top: the page (its highest layer is the nav, at 100), the veil (1000), the orb
   (1001), the dialog (1002). They are siblings rather than one wrapper on purpose: a fixed wrapper
   is a stacking context, and the page's own #orb-canvas could not then sit between the veil and the
   card. While the modal is open the live canvas is lifted to 1001, so it is the same orb, still
   animated. Where there is no live canvas (orb-static, which reduced motion also selects, or the
   early-access page, which hides it) the committed pearl.png stands in, the hero's own static orb.
   Chips: selected is ink with cream text and a cream tick, so the state is never carried by colour
   alone. NO CORAL on a chip in any state (test-waitlist-inline.mjs asserts it from computed style).
   The one coral in the modal is the italic "sooner?", in --coral-deep, the site's own heading
   italic (.display em). Labels are Instrument Sans, the live site font (no Inter). */
~~~~

### index.html:449 (stripped, css)

~~~~
/* 2026-10-27 founder ruling: the orb behind the modal is a large centred glow framing the card on all
   sides. The pearl is 1.6x the final CTA's min(80vh,92vw), because pearl.png has transparent padding
   round the orb. The live orb has none, so it is forced to 1.2x its #join size instead (bigOrb below;
   corrected 2026-10-27 from 1.6x, which rendered about 1,240px across in a 900px window). */
~~~~

Now reads:

~~~~
/* The orb behind the modal is a large centred glow framing the card on all
   sides. The pearl is 1.6x the final CTA's min(80vh,92vw), because pearl.png has transparent padding
   round the orb. The live orb has none, so it is forced to 1.2x its #join size instead (bigOrb below;
   corrected 2026-10-27 from 1.6x, which rendered about 1,240px across in a 900px window). */
~~~~

### index.html:569 (stripped, css)

~~~~
/* HERO_CARD_ROWS_V1: was .motion .hc-bw. Scoped to the ferritin card, which is the only card the 2.85s read reveal is
   for. Kept on Aditi's call after a row-layout draft of the home-draw card, where an unscoped rule hid its chips. */
~~~~

Now reads:

~~~~
/* HERO_CARD_ROWS_V1: was .motion .hc-bw. Scoped to the ferritin card, which is the only card the 2.85s read reveal is
   for. Kept after a row-layout draft of the home-draw card, where an unscoped rule hid its chips. */
~~~~

### index.html:1030 (stripped, js-line)

~~~~
// Section hash. Sections live on home, so arriving on a page path
    // (/early-access#how) has to go home first. Settle the bar to /#hash BEFORE
    // scrolling: goToSection's own guard then sees a matching URL and does not
    // push a second entry, which on a cold load would otherwise leave a
    // /early-access#how entry behind the /#how one and make back look dead.
    // Gated on the section existing so an unknown hash falls through untouched.
    // HOMEPAGE_MOTION_V1: these sections moved to /science. Old shared links (/#gaps from
    // the previous nav, /#founder) land on the moved section there instead of the hero.
~~~~

Now reads:

~~~~
// Section hash. Sections live on home, so arriving on a page path
    // (/early-access#how) has to go home first. Settle the bar to /#hash BEFORE
    // scrolling: goToSection's own guard then sees a matching URL and does not
    // push a second entry, which on a cold load would otherwise leave a
    // /early-access#how entry behind the /#how one and make back look dead.
    // Gated on the section existing so an unknown hash falls through untouched.
    // HOMEPAGE_MOTION_V1: these sections moved to /science. Old shared links (/#gaps from
    // the previous nav, `/#founder`) land on the moved section there instead of the hero.
~~~~

### index.html:1646 (stripped, js-line)

~~~~
// WAITLIST_STEP2_V1. Founder's copy, ruling 6, 2026-10-26. The thank-you is followed by the
    // done or doneNoMail line above, so the inbox claim stays exactly as true as it is today.
~~~~

Now reads:

~~~~
// WAITLIST_STEP2_V1. The thank-you is followed by the
    // done or doneNoMail line above, so the inbox claim stays exactly as true as it is today.
~~~~

### index.html:1745 (stripped, js-line)

~~~~
// 2026-10-27 founder ruling: the live orb moves to the centre at 1.2x its #join size (desktop or
      // phone keyframe, as measure() would pick), eased over 600ms, none under reduced motion.
~~~~

Now reads:

~~~~
// The live orb moves to the centre at 1.2x its #join size (desktop or
      // phone keyframe, as measure() would pick), eased over 600ms, none under reduced motion.
~~~~

## science.html

### science.html:39 (stripped, css)

~~~~
/* OLIVE_PALETTE_V1: the approved accent is olive, replacing the earlier accent 1:1 by role.
     --olive is text and marks, --sage is fills, --sage-soft and --sage-pale are tints. */
~~~~

Now reads:

~~~~
/* OLIVE_PALETTE_V1: the accent is olive, replacing the earlier accent 1:1 by role.
     --olive is text and marks, --sage is fills, --sage-soft and --sage-pale are tints. */
~~~~
