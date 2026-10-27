# HTML comment archive, 2026-10-27

Every `<!-- -->` comment that was in a served page of biowellth-website, removed from the pages on
2026-10-27 because page comments are public in the page source. Each is kept here verbatim, under the
file and the line it started on **at commit `ff3abee`** (the last commit before the removal). None was
functional: there were no conditional comments, and no script reads comment nodes.

The change tokens these comments carried still appear in commit messages and in the CSS and JS
comments, which this removal did not touch.

## dashboard.html

### dashboard.html:8

~~~~
<!-- SANA_V1 companion + home surface identity -->
~~~~

### dashboard.html:10

~~~~
<!-- FAVICON_OLIVE_V1: ?v=olive1 makes browsers fetch the new olive icon instead of the cached brown one. -->
~~~~

### dashboard.html:12

~~~~
<!-- DASHBOARD_V2_DESIGN: Fraunces added for the dashboard's headings, numbers and Sana's read. The other three families stay, because the other views still set them. -->
~~~~

### dashboard.html:2447

~~~~
<!-- ERROR_MONITORING_V1 — Sentry browser SDK, ERRORS ONLY.
     Added 2026-09-20. There was no client-side error capture of any kind before this:
     measured against the served bytes, sentry/posthog/gtag/googletagmanager/mixpanel/
     amplitude/logrocket/datadog/bugsnag were all 0, and so were window.onerror and
     unhandledrejection.

     POSITION: IN <head>, BEFORE THE MAIN INLINE APPLICATION SCRIPT, AND THIS IS THE ONE
     PLACE THIS PAGE DELIBERATELY DIFFERS FROM index.html. That script begins at the
     <script> after the supabase-js tag in the body and runs for roughly nine thousand
     lines — it is very nearly the whole application. Loading Sentry at the end of body,
     as the landing page does, would mean any error thrown while that script is parsed or
     during its first run happens BEFORE the handlers exist and is never captured. The
     code most worth watching would have been the code least watched.
     index.html keeps its end-of-body position: it is public, its scripts are small, and
     nothing there reads health data, so there the ordering trade goes the other way.

     THE "BYTE-IDENTICAL CONFIG" CLAIM IS ABOUT THE INIT BLOCK, NOT THE PLACEMENT. The
     (function(){...})() below is byte-identical to index.html's and is verified by md5 on
     every change; where the tag sits in the document is a per-page decision.

     THIS PAGE IS THE SENSITIVE ONE. It reads reports, results, markers and profiles for a
     signed-in woman, which is why the scrubbing exists at all and why the landing page
     carries the same config rather than the other way round.

     tracesSampleRate IS 0 HERE TOO. An earlier draft had 0.1 on this page; it was amended
     to 0. Performance transactions carry URLs and timings for the very endpoints the
     breadcrumb rule suppresses, so sampling them would reopen the hole from the other
     side.

     THE BUNDLE IS THE ERRORS-ONLY ONE, AND THAT IS A STRUCTURAL GUARANTEE rather than a
     configuration one. bundle.min.js is 90,620 bytes; bundle.replay.min.js is 216,753 and
     bundle.tracing.min.js is 147,894. The recorder and the tracing code are not in this
     file, and the bundle says so itself — it carries the string "You are using
     replayIntegration() even though this bundle does not include replay". The
     replaysSessionSampleRate and replaysOnErrorSampleRate zeros below are therefore a
     second layer over a bundle that physically cannot record a session. On a page that
     renders a woman's blood panel, that distinction is the whole point.

     PINNED WITH SRI, NO LOADER. A loader script is itself mutable, so pinning its version
     pins nothing. The integrity hash was computed from the fetched bytes and confirmed
     identical across two independent fetches.

     NO SOURCEMAPS AND NO BUILD STEP, deliberately. This file is served unminified as
     authored (82 bytes per line average, 7,936 indented lines), so stack frames already
     carry real line numbers. -->
~~~~

### dashboard.html:2718

~~~~
<!-- Brand mark sprite, lifted verbatim from index.html (#bw-mark) -->
~~~~

### dashboard.html:2789

~~~~
<!-- TITLE CASE, ruled 2026-09-16. The three top bar labels are nav items and read
           as one row, so they are cased alike. Deliberately NOT refactored into a
           constant tonight: that is larger than the ruling and would ride along
           unreviewed. The chip and the companion card button keep SENTENCE case,
           because their label is a sentence and not a nav label.
           The label itself is not quoted here on purpose. The suite counts every
           occurrence of that string outside SANA_COPY as an inline literal, and it is
           right to: a string sitting in the markup is in the markup whether or not a
           comment wraps it. Quoting it here turned that assertion red, which is the
           check doing its job. -->
~~~~

### dashboard.html:2800

~~~~
<!-- CAMERA_READING_NAV_V1. Ships HIDDEN and EMPTY, and both matter.
           HIDDEN because openFaceScan returns false and does nothing visible when
           sana consent has not been granted. A bar button that silently does
           nothing is a dead control, and this file's own standard is that a
           control which will not work is not rendered. renderScanEntry reveals it
           on the same consent gate that reveals the companion button, so the two
           surfaces cannot disagree about whether the reading is available.
           EMPTY because the label comes from SANA_COPY at render time, like every
           other string in this feature, so the no-colon and no-em-dash rule stays
           checkable in one place. -->
~~~~

### dashboard.html:2811

~~~~
<!-- ASK_SANA_NAV_V1. Ships HIDDEN and EMPTY for the same two reasons btn-scan does.
           HIDDEN because the control must not point at a chat that is not there: askSana
           scrolls to #sana-mount and focuses its input, and with SANA_CHAT_ENABLED off or the
           mount absent there is no input to focus. sanaMountChat reveals it at the moment it has
           actually built the input, so the bar cannot offer a conversation the page is not
           hosting.
           EMPTY because the label comes from SANA_COPY at render time, like every other string
           in this feature, so the no-colon and no-em-dash rule stays checkable in one place.
           NOT gated on consent, deliberately. sanaSend already asks for consent in the thread
           when it is missing, so a woman who has not consented is taken to the place that asks
           her rather than shown nothing. Hiding it would withhold the request, not the feature. -->
~~~~

### dashboard.html:2828

~~~~
<!-- Account overlay (settings). Reuses the .del-modal backdrop idiom (fixed overlay, explicit-button
     close, no backdrop/Escape). Houses the relocated Sign out (#logout) and the typed-confirm delete
     flow. The delete WIRING is unchanged — same #del-input / #del-confirm / delete-account invoke /
     failure copy; only the markup moved here from the standalone modal, and the trigger is now the
     inline "Delete my account" reveal (#del-open) instead of a separate modal. Static text only. -->
~~~~

### dashboard.html:2848

~~~~
<!-- CONSENT_WITHDRAWAL_V3. Built dark. renderConsentControls returns without rendering
         unless SANA_CHAT_ENABLED is on, so with the flag off this stays an empty div and the
         Account panel looks exactly as it does today. privacy.html's "or through your account
         settings" clause is removed until this ships un-darked, see PRIVACY_TRUTH_V2 there. -->
~~~~

### dashboard.html:2876

~~~~
<!-- DRAW_CONTEXT_SUBMIT_V1 (Brief B): pre-file page has NO questions, no standalone LMP -->
~~~~

### dashboard.html:2906

~~~~
<!-- DRAW_CONTEXT_SUBMIT_V1 (Brief B): consolidated "About this draw", shown after file pick -->
~~~~

### dashboard.html:2913

~~~~
<!-- ABOUT_YOU_DRAW_V1. The one way into About-you from this card, shown only while
               about_you_status is null or 'skipped'. It opens the same pop-up; answers saved
               there are on her profile before "Start my reading" releases the reading. -->
~~~~

### dashboard.html:2917

~~~~
<!-- CYCLE_CAPTURE_V1 (relocated into the DRAW_CONTEXT_SUBMIT_V1 consolidated block) -->
~~~~

### dashboard.html:2929

~~~~
<!-- CYCLE_DAY_ORDER_V1. Lifted out of #cyc-lens and placed AFTER #cyc-questions,
               because in the first-time state both are on screen at once and the cycle day
               control used to render ABOVE the question that reveals it. It carries `hidden`
               in the markup now: as a child of the lens it inherited the lens's hidden state,
               and outside it that no longer happens, so the initial state has to be explicit. -->
~~~~

### dashboard.html:2947

~~~~
<!-- ABOUT_YOU_DRAW_V1. The supplement chips and the "Anything else you take regularly?" box
               that stood here are gone. Supplements and medicines are properties of HER, asked once
               in About-you; this card keeps only what describes THIS test. -->
~~~~

### dashboard.html:2962

~~~~
<!-- SANA_NO_PANEL_V1. A third view beside upload and dashboard, so a signed in
       user with zero completed panels can reach Sana. It is deliberately NOT inside
       view-upload, because that view sits behind the consent and date of birth gates
       and Sana must not become entangled with them. It carries its own upload
       affordance, so reaching Sana never removes the path to uploading a panel.
       Mounted through sanaMountChat with its own container ids. The single global
       SANA_MOUNTED flag keeps this and the dashboard mount mutually exclusive,
       because sanaSend resolves sana-input, sana-thread and sana-send by id and a
       second live mount is the duplicate-id defect recorded at SANA_TURN_IDENTITY_V1. -->
~~~~

### dashboard.html:2983

~~~~
<!-- AI_DISCLOSURE_V1 -->
~~~~

### dashboard.html:3000

~~~~
<!-- REVIEW_GATE_V1 (supa docs/review-gate-phase2-spec.md, decision 5). Shown ONLY for a report whose
       status is awaiting_review. Copy is exact; do not reword it.
       REVIEW_GATE_COPY_V2 (2026-09-25, founder copy): the body is REPLACED, superseding the spec's
       "Our team checks every report before you see it during early access. You'll have it within 24
       hours, and we'll email you the moment it's ready." It now says what the check is for (accuracy)
       and who does it. The confidentiality sentence is deliberately withheld until the reviewer
       agreement is signed; its wording is held in docs/review-confidentiality-line.md, not here.
       REVIEW_GATE_COPY_V3 (2026-09-26, counsel-approved): adds "Your reviewer may see your report and the
       health information used to prepare it." between the two V2 sentences. Exact; do not reword it. -->
~~~~

### dashboard.html:3045

~~~~
<!-- DASHBOARD_V2_DESIGN: the CSS pearl orb. Decorative only, so aria-hidden; the ring's
               arc (::after) still draws the score from --p, and the number sits above the orb. -->
~~~~

### dashboard.html:3054

~~~~
<!-- DASHBOARD_V2_DESIGN: the weekday eyebrow and the time-of-day greeting. Both are filled
             by v2PaintHero, never by a renderer, and both are empty until it runs, so a page where
             it never runs shows the hero exactly as before. The name is shown ONLY when the profile
             carries one; the cycle part ONLY when the cycle card resolved a phase. -->
~~~~

### dashboard.html:3061

~~~~
<!-- RETIRED IN THE HERO 2026-09-23, at the founder's ruling. This carried the
             "Based on N of the 7 systems ..." sentence; that sentence now opens the
             "What's this?" popover, beside the paragraph explaining the score it qualifies.

             THE ELEMENT AND ITS ID STAY so every reader and test still resolves, and
             renderDashboard clears and hides it on each render rather than trusting that
             nothing writes to it. It is empty and hidden on every path; there is no payload
             that fills it. -->
~~~~

### dashboard.html:3072

~~~~
<!-- DASHBOARD_V2_DESIGN: two shortcuts, no new behaviour. "See what changed" scrolls to
             #prios-wrap and is hidden by CSS whenever that section is hidden, so it never points at
             nothing. The second button forwards to #btn-report, the existing Save my full report
             action, so there is still one implementation of it. -->
~~~~

### dashboard.html:3081

~~~~
<!-- THE FOUR-COUNT ROW MOVED OUT AND CAME BACK, both on 2026-09-23. f4fa2a4 put it at
           the top of #theme-wrap on the reasoning that the hero should carry one thing to read;
           seen on the page, the counts belong with the score they summarise, so it is here
           again. Recorded rather than quietly reverted, because the next person to think the
           hero is crowded should know this was tried and what it looked like.

           IT SURVIVES THE ROUND TRIP UNCHANGED, and that is not luck. renderDashboard fills it
           by id ($("hero-stats")), never by position, and its colours are split between a light
           base rule and a .reveal-head-scoped dark one (:1154-1159), so the same element reads
           correctly in either place. -->
~~~~

### dashboard.html:3092

~~~~
<!-- HERO_TRAJ_V1 host. Empty and hidden in markup; renderHeroTrajectory fills it
           after the stats render, and hides it again when there is nothing to draw. -->
~~~~

### dashboard.html:3103

~~~~
<!-- SANA_DESCRIPTOR_V1 -->
~~~~

### dashboard.html:3107

~~~~
<!-- SANA_ONLINE_REMOVE_V1: the DASHBOARD_V2_DESIGN "Online" pill was removed here at the founder's request on 2026-10-15. -->
~~~~

### dashboard.html:3112

~~~~
<!-- SANA_CHAT_V1 — built dark. Both nodes are created by JS only when
           SANA_CHAT_ENABLED is true, so with the flag off they do not exist in
           the DOM at all rather than being hidden. See sanaMountChat. -->
~~~~

### dashboard.html:3117

~~~~
<!-- AI_DISCLOSURE_V1 -->
~~~~

### dashboard.html:3119

~~~~
<!-- FACE_SCAN_ENTRY_V1. Hidden until sanaConsentGranted resolves true; see
           renderScanEntry. Every string is set from SANA_COPY, so the no-colon
           and no-em-dash rule stays checkable in one place.

           THE INTRO SITS ABOVE THE BUTTON IN MARKUP, and that is the point. A
           browser camera prompt arriving with no preceding sentence is the
           failure this block exists to avoid, and document order is the only
           thing a handler, a race or a style cannot reorder later. It is not a
           class, not an insertBefore, not a flex order.

           It sits BELOW the AI disclosure so that note stays attached to the
           chat it describes. A camera reading is not Sana talking.

           Dashboard card only. view-companion has its own -nopanel mounts and a
           second copy here would duplicate the ids. -->
~~~~

### dashboard.html:3140

~~~~
<!-- CARD_ORDER_V1 2026-09-06: score card first, Sana second, invitations third.
         Order here is the ONLY thing that sets it -- no JS moves these three nodes
         (zero insertBefore/appendChild/prepend on any of them) and no CSS order/flex
         trick is involved. Move the markup, not a style. -->
~~~~

### dashboard.html:3144

~~~~
<!-- CYCLE_CARD_V1 phone host. Shown only at 960px and below, AFTER Sana (founder ruling
         2026-10-12), so CARD_ORDER_V1's score, Sana order is kept. One render fills this and
         #cycle-card-rail; the media query shows exactly one of them. -->
~~~~

### dashboard.html:3151

~~~~
<!-- PRIORITY_HEADING_V1 -- was "What needs a closer look". It must not reuse the hero chip's
           "closer look" wording, because the two count different things. The chip "Worth a closer
           look" counts flag-tier markers (systems[].markers[].status through sysStatus). This list is
           payload.priorities, which Call B can build from watch-tier markers and which
           PRIORITY_BAND_RECONCILE_V1 keeps, so a real panel could show "0 Worth a closer look" right
           above priority cards. "What needs attention" is the name the walkthrough's ruled copy
           (wtItems) already gives this section, so the page and the walkthrough now agree. -->
~~~~

### dashboard.html:3159

~~~~
<!-- CONFOUNDER_NOTE_V1 — Call B's panel-level caveat. Sits between the section label and
           the cards because it governs how to read them: it is the sentence that says which
           systems could not be scored and why. Reuses .report-note, the page's existing
           panel-level note box, rather than introducing a component. -->
~~~~

### dashboard.html:3176

~~~~
<!-- DASHBOARD_V2_DESIGN: #escalated-wrap MOVED here from directly under #prios-wrap, so it can
         sit beside #quiet-wrap as the v2 pair (one glass card, one olive block). Moved, not edited:
         same id, same label, same renderer. #ddc and #clarify keep their place under the
         priorities, which is where their prompts belong. The wrapper is layout only; it carries no
         id and nothing reads it. -->
~~~~

### dashboard.html:3188

~~~~
<!-- DENSITY_COLLAPSE_V3, 2026-09-23. THE INTRO IS BACK WHERE IT STARTED, loose and visible
           under the label, and V2 moved it inside the first card's disclosure for one day. The
           round trip is recorded rather than erased because the reasoning that moved it still
           reads well and is still wrong for this one line: a section whose every card is shut
           needs one sentence on the page saying why the section is there, and a reader who never
           opens a card would otherwise meet a label and three headlines with nothing joining
           them. The CLOSING line did not come back; it stays in the first card's disclosure,
           because it is a reflection on what was just read and has no job above it.
           NEITHER SENTENCE WAS EDITED at any point: the strings moved, they did not change. -->
~~~~

### dashboard.html:3205

~~~~
<!-- DENSITY_COLLAPSE_V2, 2026-09-23. #found-lead sat ABOVE the levers and #found-closing
             BELOW them. Both now sit under the row behind one "Why these" disclosure, closed by
             default. THE IDS AND CLASSES ARE UNCHANGED, which is what keeps renderFoundations
             writing to them with no edit, and NEITHER PARAGRAPH WAS TOUCHED. -->
~~~~

### dashboard.html:3228

~~~~
<!-- CYCLE_CARD_V1 desktop host, top of the side rail. Hidden at 960px and below, where the rail
         stacks after the whole main column and #cycle-card-main shows instead. -->
~~~~

### dashboard.html:3231

~~~~
<!-- DASHBOARD_V2_DESIGN: #rail-systems MOVED above #longi-wrap, so the status pills come
         first in the lower band. Same id, same renderer. The cycle host stays first in the rail, as
         CYCLE_CARD_V1's placement test requires, and is now never displayed (see .cy-host-rail). -->
~~~~

### dashboard.html:3266

~~~~
<!-- #theme-wrap LIVED HERE and moved into the #view-themes overlay on 2026-09-23, reached
         from the "By theme" row of the Browse everything card. The block itself is unchanged --
         same id, same heading, same six cards, same renderer -- only its home moved. -->
~~~~

### dashboard.html:3329

~~~~
<!-- THEME PAGE OVERLAY. Same shape as #view-gaps and #view-systems: fixed, own scroll, a
         sticky head carrying only Back. NO TITLE IN THE HEAD, deliberately -- #theme-wrap carries
         its own "Everything else, by theme" label and repeating it would be a second heading for
         one page, which is a change to the copy rather than a change of address.

         Z-INDEX 140, BELOW the markers view at 150, and that is load-bearing rather than
         arbitrary. A theme panel's "See all N markers" routes to openMarkersView (:10379), so a
         themes page sitting ABOVE the markers view would open it underneath itself and look like
         a dead tap. Every other overlay is above 150 because none of them hands off downward. -->
~~~~

### dashboard.html:3374

~~~~
<!-- REPORT GENERATOR v1a — full-screen overlay, direct body child so @media print can
     isolate it (body>* hidden, this shown). Content assembled render-only from
     window.__rdPayload by openReport(). -->
~~~~

### dashboard.html:3389

~~~~
<!-- DOCTOR SUMMARY v1 -- a SECOND document beside the health report, one to two pages, built to be
     carried into an appointment. Reuses the .report-view chrome (Back / Save as PDF) and the print
     isolation that already hides body>* for whichever .report-view is open, so the existing report
     is untouched. The document itself carries its own class, .doctor-doc, and its own print block.
     Content is assembled render-only from window.__rdPayload by openDoctor(). -->
~~~~

### dashboard.html:15588

~~~~
<!-- AGE_AFFIRM_V1 — grandfathered accounts only. Fires when profiles.age_affirmed_at is null
     AND user_metadata carries no affirmation, i.e. accounts created before this shipped. BLOCKING:
     no skip, no backdrop close, no Escape. Two states in one card, swapped by JS: the affirm state
     and the under-18 exit. -->
~~~~

### dashboard.html:15594

~~~~
<!-- state 1: affirm -->
~~~~

### dashboard.html:15605

~~~~
<!-- state 2: under-18 exit. Sign out is the neutral default; deletion is offered, never pushed. -->
~~~~

### dashboard.html:15616

~~~~
<!-- TESTER_GATE_V1 — dark behind TESTER_GATE_ENABLED. Blocking: no backdrop close,
     no Escape, no skip. Hidden until testerGate() decides it is needed. -->
~~~~

### dashboard.html:15673

~~~~
<!-- ONBOARDING_V2 — dark behind ONBOARDING_ENABLED. One question at a time,
     Skip on every screen. Skip writes nothing at all. -->
~~~~

### dashboard.html:15680

~~~~
<!-- ORB. World-space: a child of the track, absolutely positioned, so the
             pan carries it. Its `left` is a track coordinate (i*step + half), which
             is what makes the spec's leap() maths work. Seated at top:-84px above
             the cards. The mark is the site's own #bw-mark symbol at 56px, teal via
             currentColor -- the one sanctioned deviation from the spec file, whose
             own mark is a placeholder. -->
~~~~

### dashboard.html:15689

~~~~
<!-- cards are appended here, one per applicable screen, plus a done card -->
~~~~

## index.html

### index.html:2

~~~~
<!-- PRIVACY_TRUTH_V1 -->
~~~~

### index.html:8

~~~~
<!-- LANDING_COPY_V1: copy only, home-draw story (2026-10-16) -->
~~~~

### index.html:9

~~~~
<!-- RANGES_WORDING_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### index.html:10

~~~~
<!-- WAITLIST_INDIA_REMOVE_V1: the closing sentence naming the waitlist region was removed at Aditi's call. -->
~~~~

### index.html:12

~~~~
<!-- FAVICON_OLIVE_V1: ?v=olive1 makes browsers fetch the new olive icon instead of the cached brown one. -->
~~~~

### index.html:20

~~~~
<!-- RANGES_WORDING_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### index.html:28

~~~~
<!-- RANGES_WORDING_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### index.html:34

~~~~
<!-- JSON-LD: Organization -->
~~~~

### index.html:35

~~~~
<!-- FOUNDER_NAME_REMOVE_V1: the Organization block no longer carries the "founder" Person or the "sameAs" key, whose only entry was the personal LinkedIn. -->
~~~~

### index.html:52

~~~~
<!-- JSON-LD: WebSite -->
~~~~

### index.html:63

~~~~
<!-- JSON-LD: FAQPage -->
~~~~

### index.html:64

~~~~
<!-- FERRITIN_RANGE_V1 (2026-10-26, Aditi): the ferritin answer said "Functional medicine commonly targets 70-100 ng/mL". JSON cannot carry a comment, so this one sits outside the block. Ferritin target is 60 to 100 in the library, pending FM-advisor sign-off (advisor-packet-2026-09-02.md); no range numbers in marketing until approved. -->
~~~~

### index.html:115

~~~~
<!-- HOMEPAGE_MOTION_V1: the brand serif stays Fraunces, which this repo already loads, rather
     than the Instrument Serif the brief named as a default. Plus Jakarta Sans and JetBrains Mono
     are dropped from this page only; the app and legal pages still load them. -->
~~~~

### index.html:119

~~~~
<!-- HOMEPAGE_MOTION_V1: decide the motion and orb mode before first paint, so no state flashes.
     motion      the GSAP choreography may hide intro states. Removed again if GSAP fails to load.
     orb-live    WebGL is available, the canvas orb runs.
     orb-static  reduced motion or no WebGL, the committed pearl.png stands in. -->
~~~~

### index.html:630

~~~~
<!-- NAV. HOMEPAGE_MOTION_V1: frosted pill, new brand mark (olive dot + brown serif wordmark). -->
~~~~

### index.html:633

~~~~
<!-- BRAND_MARK_HEADER_V1: the BioWellth mark, the same paths as dashboard.html's #bw-mark symbol (the brown mark, not the olive-disc favicon). Decorative; the wordmark text stays the accessible name. -->
~~~~

### index.html:702

~~~~
<!-- ABOUT_LABEL_V1: visible label only, href /science unchanged -->
~~~~

### index.html:704

~~~~
<!-- WAITLIST_INLINE_V1: scrolls to the final CTA form (#join). route() and goToSection()
           handle it from any page, exactly as the #sana link above does. -->
~~~~

### index.html:711

~~~~
<!-- HOME. HOMEPAGE_MOTION_V1. Every section is transparent so the fixed orb travels behind it.
     data-orb is "x,y,size": x and y as fractions of the viewport from its centre, size as a
     fraction of the viewport's shorter side. data-orb-m is the same under 768px. -->
~~~~

### index.html:720

~~~~
<!-- HERO_PREVENTIVE_EYEBROW_V1: was "Built for South Asian women", changed at Aditi's call. -->
~~~~

### index.html:723

~~~~
<!-- LANDING_COPY_V1: copy only, home-draw story (2026-10-16) -->
~~~~

### index.html:724

~~~~
<!-- RANGES_WORDING_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### index.html:725

~~~~
<!-- HERO_COPY_V1: lede rewritten and the upload line removed from the hero at Aditi's call (2026-10-26).
         "feel&nbsp;your&nbsp;best." is joined so "best." does not sit alone on a line at 375px. -->
~~~~

### index.html:729

~~~~
<!-- WAITLIST_INLINE_V1: form instance 1. Replaces the button that opened the early-access page. -->
~~~~

### index.html:744

~~~~
<!-- HERO_LINE_REMOVE_V1: the offer line and "How we read a panel" link that sat here were removed (Aditi, 2026-10-26) -->
~~~~

### index.html:762

~~~~
<!-- HERO_CARD_ROWS_V1 (2026-10-26, Aditi): was "Illustrative example. Not medical advice." -->
~~~~

### index.html:765

~~~~
<!-- LANDING_COPY_V1: copy only, home-draw story (2026-10-16) -->
~~~~

### index.html:766

~~~~
<!-- HOME_DRAW_COPY_V1 (2026-10-26, Aditi): the card now frames one home draw as your usual checkup plus 4 areas
           it skips. No verified draw count exists yet, so no total is shown. Replace with the lab partner's count when
           the panel is final. "your&nbsp;usual&nbsp;checkup" is joined so "checkup" does not sit alone on a line.
           Superseded 2026-10-26 by HERO_CARD_ROWS_V1: the eyebrow is "Your panel skipped these", the numeral is "4"
           and the caption is "categories." over "We test them." The 4 is an illustrative example, not a universal
           count: what a panel skips varies by person, which the hero caption under the cards now says. The 01 card
           carries the 170+ draw count (PANEL_COUNT_V1). -->
~~~~

### index.html:777

~~~~
<!-- HERO_COPY_V1: Free T3 and Free T4 become Full thyroid, hsCRP becomes Inflammation, and Adrenal
               hormones covers AM cortisol and DHEA-S. Progesterone keeps its name. Still six markers, so the 6
               above holds. HERO_CARD_CAPTION_V1 (2026-10-26): the caption next to the 6 now reads "markers our
               panel adds, across four areas", so it explains why six markers show as four chips.
               Corrected 2026-10-26 by HERO_CARD_AREAS_V1: the card now counts areas, not markers. The numeral is 4,
               the caption is "areas our panel adds", and the aria-label says 4 areas. The four chips still cover
               the same six markers (Free T3, Free T4, hsCRP, AM cortisol, DHEA-S, Progesterone).
               Corrected 2026-10-26 by HERO_CARD_CHIPS_V1: the chips are now four areas covering the seven markers
               science.html says the panel adds. Thyroid is Free T3 and Free T4, Iron stores is ferritin,
               Inflammation is hsCRP, and Stress and cycle hormones is AM cortisol, DHEA-S and progesterone. -->
~~~~

### index.html:794

~~~~
<!-- HOME_CLEANUP_V1: the marker ticker that sat here was removed (Aditi, 2026-10-26). -->
~~~~

### index.html:796

~~~~
<!-- Drift. The chart is olive: it is BioWellth's read of the trend. -->
~~~~

### index.html:801

~~~~
<!-- RANGES_WORDING_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### index.html:802

~~~~
<!-- FERRITIN_NUMBERS_V1: data 85/60/42 -> 74/48/22 on the existing scale, y = 88 + (100 - value) * 2.4. 22 lands at y 275.2, above the 280 axis, so no rescale. The middle data-at is 0.5 because both segments are now the same length. Band and its label unchanged. -->
~~~~

### index.html:803

~~~~
<!-- FERRITIN_NUMBERS_V1: breathing room for the 22 point. The scale, band, points and labels are
             unchanged. The axis moves 280 -> 315, the dates 304 -> 339, the status labels 322 -> 357 and
             the viewBox height 330 -> 365, so +35 units. That is the smallest whole shift that leaves 16px
             or more between the 22 marker and the axis at 390, where the chart is drawn at about 0.53px per
             unit, so 16px is about 30 units below the end marker's bottom edge at 284.2. -->
~~~~

### index.html:809

~~~~
<!-- FERRITIN_RANGE_V1 (2026-10-26, Aditi): the title ended "feel-your-best range of 70 to 100." Ferritin target is 60 to 100 in the library, pending FM-advisor sign-off (advisor-packet-2026-09-02.md); no range numbers in marketing until approved. -->
~~~~

### index.html:817

~~~~
<!-- FERRITIN_RANGE_V1 (2026-10-26, Aditi): label was "Feel-your-best range 70 to 100". The band rect is
               unchanged. Ferritin target is 60 to 100 in the library, pending FM-advisor sign-off
               (advisor-packet-2026-09-02.md); no range numbers in marketing until approved. -->
~~~~

### index.html:825

~~~~
<!-- FERRITIN_NUMBERS_V1: the 74 label moved from under the point (x 100, y 172.4, middle) to its left
                 (x 84, y 157, end), because under the point it touched the line. Measured clearance from the line
                 is 12.8px at 1440 and 7.4px at 390, and from the dot 6.8px and 3.8px. -->
~~~~

### index.html:851

~~~~
<!-- LANDING_COPY_V1: copy only, home-draw story (2026-10-16) -->
~~~~

### index.html:858

~~~~
<!-- Three stacking cards. Sticky on desktop, a plain stack under 768px. -->
~~~~

### index.html:863

~~~~
<!-- LANDING_COPY_V1: copy only, home-draw story (2026-10-16) -->
~~~~

### index.html:864

~~~~
<!-- PANEL_COUNT_V1 (2026-10-26, Aditi): was "One draw" with "Your usual checkup markers, plus the ones it skips,
           drawn at home." (HOME_DRAW_COPY_V1). "21 categories" stays retired.
           170+ confirmed by Aditi 2026-10-26 for the planned home draw. Lab partner panel list pending; add it as the
           source when final, and update this number if the final panel differs. -->
~~~~

### index.html:871

~~~~
<!-- LANDING_COPY_V1: copy only, home-draw story (2026-10-16) -->
~~~~

### index.html:887

~~~~
<!-- LANDING_PRODUCT_SHOTS_V1: "What you get back". Real dashboard.html screens rendered from a synthetic
     panel by scripts/capture-landing-shots.mjs. No real person's data. data-orb is the midpoint of #read and #sana. -->
~~~~

### index.html:894

~~~~
<!-- HERO_COPY_V1: "Sana reads it with you." became "Sana, your AI companion, walks you through it." This is her
           first mention on the page now that the hero no longer introduces her, so the descriptor sits here (Aditi, 2026-10-26) -->
~~~~

### index.html:907

~~~~
<!-- HOME_CLEANUP_V1: the "See what changed, not just what is." row (trends shot, heading, paragraph) was removed
         (Aditi, 2026-10-26). The caption below stays because it also labels the dashboard mockup above as sample data. -->
~~~~

### index.html:913

~~~~
<!-- Sana. Olive section. -->
~~~~

### index.html:922

~~~~
<!-- TODO(HOMEPAGE_MOTION_V1): the Sana reply copy below needs reviewer sign-off before launch. -->
~~~~

### index.html:927

~~~~
<!-- LANDING_COPY_V1: copy only, home-draw story (2026-10-16) -->
~~~~

### index.html:928

~~~~
<!-- FERRITIN_NUMBERS_V1: 85 to 42 -> 74 to 22 -->
~~~~

### index.html:937

~~~~
<!-- Founder. The full story is on /science#founder. -->
~~~~

### index.html:941

~~~~
<!-- FERRITIN_NUMBERS_V1: founder quote -->
~~~~

### index.html:943

~~~~
<!-- FOUNDER_NAME_REMOVE_V1 -->
~~~~

### index.html:949

~~~~
<!-- Final CTA. The orb comes back centred and large. -->
~~~~

### index.html:955

~~~~
<!-- LANDING_COPY_V1: copy only, home-draw story (2026-10-16) -->
~~~~

### index.html:956

~~~~
<!-- WAITLIST_INDIA_REMOVE_V1: the opening sentence naming the waitlist region was removed at Aditi's call. -->
~~~~

### index.html:958

~~~~
<!-- HOMEPAGE_MOTION_V1 said this repo had no email-capture endpoint, so an email field here
           would collect an address and then drop it, and the pill kept one button instead.
           SUPERSEDED by WAITLIST_INLINE_V1, which added that endpoint (backend waitlist-signup).
           Form instance 2. The signup notice under it is counsel's wording and replaces "Your data
           is yours. Never sold." -->
~~~~

### index.html:981

~~~~
<!-- /page-home -->
~~~~

### index.html:983

~~~~
<!-- EARLY ACCESS -->
~~~~

### index.html:993

~~~~
<!-- WAITLIST_INLINE_V1: form instance 3. It replaces the third-party embedded form, its popup
         and the script that passed campaign tags into it. The tag rule lives on in the
         WAITLIST_INLINE_V1 script at the end of body. The former provider's responses are kept
         there and are not touched by this site (privacy policy v1.4, section 3). -->
~~~~

### index.html:1016

~~~~
<!-- LANDING_COPY_V1: copy only, home-draw story (2026-10-16) -->
~~~~

### index.html:1018

~~~~
<!-- RANGES_WORDING_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### index.html:1037

~~~~
<!-- /page-early-access -->
~~~~

### index.html:1039

~~~~
<!-- FOOTER. HOMEPAGE_MOTION_V1: light, one line of disclaimer, the legal links and support. -->
~~~~

### index.html:1042

~~~~
<!-- LANDING_COPY_V1: copy only, home-draw story (2026-10-16) -->
~~~~

### index.html:1043

~~~~
<!-- RANGES_WORDING_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### index.html:1050

~~~~
<!-- FOUNDER_NAME_REMOVE_V1: the founder name and LinkedIn link were removed from the footer. -->
~~~~

### index.html:1199

~~~~
<!-- HOMEPAGE_MOTION_V1. GSAP + ScrollTrigger from cdnjs, Lenis from jsDelivr, all deferred.
     Three.js is NOT a tag here: the motion script injects it only when the orb will actually
     run (motion allowed and WebGL present), so reduced-motion and no-WebGL visitors never
     download it. If GSAP fails, the onerror drops .motion so every state renders final. -->
~~~~

### index.html:1677

~~~~
<!-- WAITLIST_STEP2_V1, amended 2026-10-27. ONE modal for the optional step 2, whichever of the three
     forms submitted (it used to be a template cloned into each card). The veil, the pearl stand-in and
     the dialog are siblings so the live orb canvas can sit between the veil and the card (see the CSS).
     Copy is the founder's (ruling 6, 2026-10-26, and the 2026-10-27 amendment). The stored codes are the
     CHECKs in backend migration 0077 and validate.ts. -->
~~~~

### index.html:2046

~~~~
<!-- ERROR_MONITORING_V1 — Sentry browser SDK, ERRORS ONLY.
     Added 2026-09-20. There was no client-side error capture of any kind before this:
     measured against the served bytes, sentry/posthog/gtag/googletagmanager/mixpanel/
     amplitude/logrocket/datadog/bugsnag were all 0, and so were window.onerror and
     unhandledrejection.

     THE BUNDLE IS THE ERRORS-ONLY ONE, AND THAT IS A STRUCTURAL GUARANTEE rather than a
     configuration one. bundle.min.js is 90,620 bytes; bundle.replay.min.js is 216,753 and
     bundle.tracing.min.js is 147,894. The recorder and the tracing code are not in this
     file, and the bundle says so itself — it carries the string "You are using
     replayIntegration() even though this bundle does not include replay". The
     replaysSessionSampleRate and replaysOnErrorSampleRate zeros below are therefore a
     second layer over a bundle that physically cannot record a session.

     PINNED WITH SRI, NO LOADER. A loader script is itself mutable, so pinning its version
     pins nothing. The integrity hash was computed from the fetched bytes and confirmed
     identical across two independent fetches.

     NO SOURCEMAPS AND NO BUILD STEP, deliberately. This file is served unminified as
     authored (65 bytes per line average, 641 indented lines), so stack frames already
     carry real line numbers.

     POSITION: END OF BODY, AND IT DIFFERS FROM dashboard.html ON PURPOSE. This page is
     public, its scripts are small, and nothing here reads health data, so the cost of
     loading last — parse-time errors in earlier inline script are missed — is worth
     paying to keep a third-party script behind the page's own. The dashboard makes the
     opposite trade and loads Sentry in <head>, because that page is almost entirely ONE
     inline application script and loading last would miss exactly the code most worth
     watching.

     THE "BYTE-IDENTICAL CONFIG" CLAIM IS ABOUT THE INIT BLOCK, NOT THE PLACEMENT. The
     (function(){...})() below is byte-identical to the dashboard's and is verified by md5
     on every change; where the tag sits in the document is a per-page decision. -->
~~~~

## login.html

### login.html:8

~~~~
<!-- FAVICON_OLIVE_V1: ?v=olive1 makes browsers fetch the new olive icon instead of the cached brown one. -->
~~~~

### login.html:10

~~~~
<!-- LOGIN_PALETTE_V1: index.html's font link, Fraunces plus Instrument Sans. Plus Jakarta Sans (only .brand-name and h1)
     and JetBrains Mono (used by nothing) are no longer loaded. -->
~~~~

### login.html:81

~~~~
<!-- LOGIN_BRAND_MARK_V1: the BioWellth mark replaces the teal "B" placeholder. Decorative; "BioWellth" beside it stays the accessible name. -->
~~~~

### login.html:153

~~~~
<!-- CREATE ACCOUNT -->
~~~~

### login.html:157

~~~~
<!-- LOGIN_DEFAULT_V1. A real form, with a name on every control. Without one the
           browser has no field grouping to reason about and falls back to position, which
           is how a saved email ended up in Your name. -->
~~~~

### login.html:169

~~~~
<!-- AGE_AFFIRM_V1 — unticked by default, never pre-checked. The button below is
           disabled until this is ticked; the handler re-checks it so the gate does not
           live only in a DOM property. -->
~~~~

### login.html:181

~~~~
<!-- SIGN IN -->
~~~~

### login.html:195

~~~~
<!-- CHECK YOUR EMAIL. LOGIN_FLOW_V2. Confirmations are on, so a successful signUp
         returns NO session and the account is inert until the link is opened. Swapping
         straight to the sign in form told the user to do the one thing that cannot work
         yet. The address is written with textContent, never innerHTML, because it is
         attacker-supplied text arriving from a form field. -->
~~~~

## privacy.html

### privacy.html:2

~~~~
<!-- PRIVACY_TRUTH_V1 -->
~~~~

### privacy.html:11

~~~~
<!-- FAVICON_OLIVE_V1: ?v=olive1 makes browsers fetch the new olive icon instead of the cached brown one. -->
~~~~

### privacy.html:16

~~~~
<!-- LEFTOVERS_PALETTE_V1: Fraunces replaces Plus Jakarta Sans, the same link index.html uses. -->
~~~~

### privacy.html:79

~~~~
<!-- BRAND_MARK_HEADER_V1: the BioWellth mark, the same paths as dashboard.html's #bw-mark symbol (the brown mark, not the olive-disc favicon). Decorative; the wordmark text stays the accessible name. -->
~~~~

### privacy.html:167

~~~~
<!-- POLICY_RESEND_V1. Approved verbatim by counsel 2026-09-07 under Determination
     condition 6. It lands in section 3 because that is the only named third party
     section the policy has, and the heading wording is an open question with counsel.
     SUPERSEDED 2026-09-20: that question is CLOSED. Counsel resolved it in the v1.2
     round by widening the heading to "The service providers we use, named" rather than
     creating a second section, and ruled explicitly that RESEND STAYS IN SECTION 3 and
     is not to be moved merely because the section now holds non-AI providers. She
     recorded it as a heading clarification that does not reopen the underlying
     disclosures, so this paragraph is untouched and still the counsel-approved text of
     2026-09-07. The sentence above is kept rather than deleted because it is the reason
     the question was asked twice and finally answered.
     Do not edit this paragraph in place, a change is a new policy version.
     POLICY_V1_4 (WAITLIST_INLINE_V1, 2026-10-24): CHANGED IN v1.4 to add waitlist emails and
     people without accounts, per counsel's waitlist condition 1 (backend
     docs/evidence/counsel-reply-waitlist-2026-10.md). The v1.3 text approved on 2026-09-07 is
     kept in git history and in website docs/privacy-v1.4-draft.md. COUNSEL REVIEW OF THE v1.4
     WORDING IS PENDING, batched for the end of the build (founder instruction 2026-10-24). -->
~~~~

### privacy.html:185

~~~~
<!-- POLICY_V1_4 (WAITLIST_INLINE_V1, 2026-10-24): the former waitlist form provider, past tense,
     per counsel's waitlist condition 1. The categories are the form's own questions, read from the
     public form on 2026-10-24. Responses are kept there with no retention number, by founder
     ruling. Counsel review of this wording is pending, batched for the end of the build. -->
~~~~

### privacy.html:191

~~~~
<!-- POLICY_SENTRY_V1. Approved verbatim by counsel 2026-09-20, together with the
     widened section 3 heading above. Counsel recorded that she relies on our live-code
     and stored-event verification for the factual representations in it, and asked that
     the verification be preserved with the vendor record. It is, at
     biowellth-backend-supa docs/vendors/sentry.md, with the reply at
     docs/evidence/counsel-reply-sentry-2026-09-20.md.
     The IP sentence is counsel's chosen formulation. She ruled against adding the
     network-transit statement to the public policy and asked that the distinction be
     kept internally instead, so the vendor file carries it and this paragraph does not.
     Do not edit this paragraph in place, a change is a new policy version. -->
~~~~

## review.html

### review.html:6

~~~~
<!-- REVIEW_GATE_V1 (supa docs/review-gate-phase2-spec.md, decision 2). Unlinked, never indexed.
     Every read and every write goes through the review-action edge function; this page makes no
     table read of its own. review-action checks reviewers membership before reading anything. -->
~~~~

### review.html:10

~~~~
<!-- REVIEW_NO_STORE_V1. GitHub Pages cannot send response headers, so the page asks browsers not to cache
     it. The data itself comes from review-action, whose every response carries Cache-Control: no-store. -->
~~~~

### review.html:16

~~~~
<!-- FAVICON_OLIVE_V1: ?v=olive1 makes browsers fetch the new olive icon instead of the cached brown one. -->
~~~~

### review.html:18

~~~~
<!-- LEFTOVERS_PALETTE_V1: Fraunces replaces Plus Jakarta Sans, the same link login.html and index.html use, plus JetBrains Mono. -->
~~~~

### review.html:114

~~~~
<!-- REVIEWER_MFA_V1: review-action refuses any session without a verified TOTP second factor (aal2). -->
~~~~

### review.html:143

~~~~
<!-- REVIEWER_CONTEXT_V1: what Call B was told about her, from the snapshot stored in the run that built it. -->
~~~~

## science.html

### science.html:2

~~~~
<!-- HOMEPAGE_MOTION_V1: /science. The long-form homepage sections, moved here verbatim with every
     citation when the homepage became the motion-led page. Same nav, palette, fonts and footer
     as the homepage, and no orb. GitHub Pages serves this file at /science. -->
~~~~

### science.html:9

~~~~
<!-- ABOUT_LABEL_V1: title and og:title renamed, canonical and og:url stay /science -->
~~~~

### science.html:11

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:13

~~~~
<!-- FAVICON_OLIVE_V1: ?v=olive1 makes browsers fetch the new olive icon instead of the cached brown one. -->
~~~~

### science.html:201

~~~~
<!-- BRAND_MARK_HEADER_V1: the BioWellth mark, the same paths as dashboard.html's #bw-mark symbol (the brown mark, not the olive-disc favicon). Decorative; the wordmark text stays the accessible name. -->
~~~~

### science.html:270

~~~~
<!-- ABOUT_LABEL_V1: visible label only, href /science unchanged -->
~~~~

### science.html:279

~~~~
<!-- ABOUT_LABEL_V1 -->
~~~~

### science.html:287

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:312

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:321

~~~~
<!-- HOW IT WORKS. OLIVE_PALETTE_V1: moved verbatim from the homepage. -->
~~~~

### science.html:326

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:331

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:333

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:338

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:340

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:345

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:347

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:362

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:364

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:366

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:368

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:369

~~~~
<!-- FERRITIN_RANGE_V1 (2026-10-26, Aditi): was "Many practitioners aim for 70 to 100 ng/mL for women with heavy periods or high activity levels." Ferritin target is 60 to 100 in the library, pending FM-advisor sign-off (advisor-packet-2026-09-02.md); no range numbers in marketing until approved. -->
~~~~

### science.html:377

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:378

~~~~
<!-- FERRITIN_RANGE_V1 (2026-10-26, Aditi): was "Low for feeling your best, which starts around 70 to 100." Ferritin target is 60 to 100 in the library, pending FM-advisor sign-off (advisor-packet-2026-09-02.md); no range numbers in marketing until approved. -->
~~~~

### science.html:384

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:390

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:395

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:396

~~~~
<!-- SCIENCE_PANEL_DHEAS_V1: "Our panel includes them." became "Our panel adds them." to match the homepage
               card (2026-10-26). Ferritin is not in this row because the sample above shows it as tested. -->
~~~~

### science.html:415

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:416

~~~~
<!-- FERRITIN_NUMBERS_V1: 85 to 42 -> 74 to 22 -->
~~~~

### science.html:418

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:429

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:430

~~~~
<!-- FERRITIN_NUMBERS_V1: the description and the three point labels now read 74, 48, 22.
               Positions corrected in a second pass so the drawing matches the numbers. The points sit on one
               linear scale, y = 134.5 + (74 - value) * 38.25/26, so 74 is y 134.5, 48 is 172.75 and 22 is
               211, evenly spaced because the steps are equal. On that scale 70 falls at y 140.4, on the
               band's bottom edge (141), so 74 sits inside the band. 48 sits below the band and above the low
               zone, and 22 sits in the middle of the low zone (192 to 230). The band's top edge is drawn
               higher than 100 would fall, and only the band carries numbers. The value labels sit 10 above
               their points, as before, and the dashed continuation keeps the same slope. (The first version
               of this pass used the band's own scale, which left 74's dot 0.9 units over the band edge and
               22 only 2 to 4px inside the low zone.) -->
~~~~

### science.html:440

~~~~
<!-- FERRITIN_RANGE_V1 (2026-10-26, Aditi): the aria-label said "the feel-your-best range of 70 to 100" and the band label said "Feel-your-best range 70 to 100". The band rect is unchanged. Ferritin target is 60 to 100 in the library, pending FM-advisor sign-off (advisor-packet-2026-09-02.md); no range numbers in marketing until approved. -->
~~~~

### science.html:442

~~~~
<!-- functional target band -->
~~~~

### science.html:445

~~~~
<!-- functionally low zone -->
~~~~

### science.html:448

~~~~
<!-- baseline axis -->
~~~~

### science.html:450

~~~~
<!-- trajectory line -->
~~~~

### science.html:452

~~~~
<!-- projected continuation -->
~~~~

### science.html:455

~~~~
<!-- data points -->
~~~~

### science.html:459

~~~~
<!-- value labels -->
~~~~

### science.html:460

~~~~
<!-- LEFTOVERS_PALETTE_V1: the three score labels were Plus Jakarta Sans, now Instrument Sans. -->
~~~~

### science.html:464

~~~~
<!-- x axis labels -->
~~~~

### science.html:468

~~~~
<!-- status labels -->
~~~~

### science.html:473

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:487

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:490

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:493

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:510

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:534

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:571

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:575

~~~~
<!-- SCIENCE_PANEL_DHEAS_V1: DHEA-S entry, copy approved by Aditi 2026-10-26, so the list covers all seven
                 markers the panel adds and matches the homepage card. Sources verified by Aditi: MedlinePlus "DHEA
                 Sulfate Test" and Mayo Clinic Laboratories test DHES1. Unlinked, like the other entries. -->
~~~~

### science.html:611

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:617

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:623

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:632

~~~~
<!-- FOUNDER STORY. Moved verbatim from the homepage gap-analysis section. -->
~~~~

### science.html:639

~~~~
<!-- ABOUT_COPY_V1: founder line added 2026-10-16 -->
~~~~

### science.html:642

~~~~
<!-- FOUNDER_NAME_REMOVE_V1: the credit is plain "Founder", with no name and no link. -->
~~~~

### science.html:649

~~~~
<!-- PRE-LAUNCH NOTE. OLIVE_PALETTE_V1: moved verbatim from the homepage. -->
~~~~

### science.html:657

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:663

~~~~
<!-- FOOTER. HOMEPAGE_MOTION_V1: light, one line of disclaimer, the legal links and support. -->
~~~~

### science.html:666

~~~~
<!-- ABOUT_COPY_V1: copy only, home-draw story and feel-your-best wording (2026-10-16) -->
~~~~

### science.html:673

~~~~
<!-- FOUNDER_NAME_REMOVE_V1: the founder name and LinkedIn link were removed from the footer. -->
~~~~

## signup.html

### signup.html:8

~~~~
<!-- LOGIN_DEFAULT_V1. GitHub Pages has no rewrite layer, so /signup needs a real file.
     This is a stub rather than a second copy of the auth page, because two copies of a
     sign-up form drift and only one of them gets the next fix. The meta refresh covers
     the no-script case; the script below runs first and preserves any query string an
     invite link carries, with mode forced to signup. -->
~~~~

## terms.html

### terms.html:8

~~~~
<!-- FAVICON_OLIVE_V1: ?v=olive1 makes browsers fetch the new olive icon instead of the cached brown one. -->
~~~~

### terms.html:17

~~~~
<!-- LEFTOVERS_PALETTE_V1: Fraunces replaces Plus Jakarta Sans, the same link index.html uses. -->
~~~~

### terms.html:107

~~~~
<!-- FOUNDER_NAME_REMOVE_V1: the founder name and LinkedIn link were removed from the footer. -->
~~~~

## unsubscribe/index.html

### unsubscribe/index.html:9

~~~~
<!-- WAITLIST_INLINE_V1. The page behind "remove yourself from the waitlist here" in the welcome
     email. Removal deletes the waitlist row (backend waitlist-signup, POST /unsubscribe), so it
     takes one tap on a button: a page that deleted on load would be triggered by mail link
     scanners and would remove people who never clicked. Mail providers' own one-click unsubscribe
     goes straight to the function and needs no page. The token is taken out of the address bar
     straight away. Copy follows the house rules, no colons, no em dashes. -->
~~~~

## waitlist-tag/index.html

### waitlist-tag/index.html:9

~~~~
<!-- WAITLIST_INLINE_V1. The page behind the city links in the waitlist welcome email
     (backend supabase/functions/waitlist-signup/welcome-email.ts). Each link carries the person's
     unsubscribe token and one city code. The answer is saved by a POST from script on load, never
     by the GET itself: mail link scanners fetch GET URLs, and most run no script, so a scanner
     opening the link saves nothing. The token is taken out of the address bar straight away.
     Copy follows the house rules, no colons, no em dashes. -->
~~~~

## waitlist/index.html

### waitlist/index.html:6

~~~~
<!-- WAITLIST_REDIRECT_V1. One vanity path for every channel. GitHub Pages has no
     edge rules we control (the Fastly in its response headers is GitHub's, not
     ours), so the source is inferred here instead of at the edge. Precedence:
       1. an inbound utm_source wins and nothing is added
       2. Instagram in-app browser (User-Agent)   -> ig / social / link_in_bio
       3. fbclid in the query                      -> meta / social / link_in_bio
       4. Referer on substack, linkedin, youtube   -> that domain / referral
       5. otherwise                                -> direct / web / waitlist
     The inbound query string is kept byte for byte and new keys are appended
     after it, never re-serialised, so fbclid and unknown params survive exactly.
     A key already present is never overwritten.
     WAITLIST_REDIRECT_V2: the target is /?query#early-access, not /early-access/.
     /early-access/ is itself a stub that replaces to /?query#early-access, so
     going there first cost a third load. index.html's route() sees the page hash
     and replaceStates to /early-access?query with no further load, so the bar
     still ends on the clean path. Two loads instead of three. -->
~~~~
