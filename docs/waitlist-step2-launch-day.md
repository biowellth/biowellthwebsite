# WAITLIST_STEP2_V1 launch day

**State going in, as of 2026-10-27:**
- Step 2 is deployed dark. Migration 0077 is applied.
- `waitlist-signup` is v8, with the `WAITLIST_STEP2_ENABLED` kill switch (backend `ca92615`).
- The website modal is live at `7552667`.
- The switch is unset, so step 2 is OFF. No popup opens and no answer can be stored.
- Privacy policy v1.4 is live.

Launch is the steps below, in this order. Take the session lock in each repo you write, and push the
website only under the lock. A push there is the deploy.

## 1. Counsel package and reply

- **Send** backend `docs/counsel-request-waitlist-step2-2026-10.md`.
- **File the reply** verbatim as backend `docs/evidence/counsel-reply-waitlist-step2-2026-10.md`.
- **Stop here** if the reply drops or rewords an option, adds a consent step, or changes the v1.5
  wording.
  - That is a code or copy change. Make it and re-test (`test-waitlist-inline.mjs`, the backend
    waitlist suite, the palette gate) before step 2 below.
  - A reworded option changes a code only if counsel asks. If it does, a migration replaces the CHECK,
    and `validate.ts` and the website chips change in step.
- **Rollback:** none needed. Nothing has changed yet.

## 2. Publish privacy policy v1.5

- **What:** apply the wording counsel approved to `privacy.html`. The draft is section 3 of the
  counsel request.
  - Change the version line to "Version 1.5" with the new effective date.
  - Comment the changed paragraphs `POLICY_V1_5`, keeping the house convention of recording what
    changed and why.
  - Commit, push, and wait for the live `last-modified`.
- **Verify:**
  - Curl `https://biowellth.ai/privacy`. Grep "Version 1.5", and grep one sentence of the new wording
    (for example "invite you sooner").
  - Control: "Waitlist information if you join our waitlist" is still present.
  - Run `node scripts/check-live-exclusions.mjs`.
- **Rollback:** `git revert` the v1.5 commit and push, which puts v1.4 back. **Do this only while
  step 3 below is still off.** Once answers are being collected, v1.5 must stay live for as long as
  any answer is stored.

## 3. Switch step 2 on

- **What:** set the edge function secret `WAITLIST_STEP2_ENABLED` to exactly `true`. Any other value,
  including `TRUE` or `1`, leaves it off.
  - The CLI's credential lacks `edge_functions_secrets_write`. Set it in the Supabase dashboard under
    Edge Functions, then Secrets, or with `supabase secrets set` once the CLI is logged in with a
    token that has that permission.
  - The value is not secret, but the rule stands anyway: never paste a token into a command line.
  - No redeploy is needed. The function reads the switch per request.
- **Verify:** run step 4 below.
- **Rollback:** unset `WAITLIST_STEP2_ENABLED` (dashboard, or `supabase secrets unset
  WAITLIST_STEP2_ENABLED`).
  - Signups return to the old shape at once, and no popup opens.
  - Answers already stored stay in their rows. They are deleted by the normal retention, removal and
    invite paths. Delete them early only on a separate decision.

## 4. Live smoke test, with the modal

Use a fresh throwaway alias of the founder's Gmail, for example
`aditipillaiofficial+wl-launch-<time>@gmail.com`. A real welcome email goes to it.

1. **Open the popup.** On `https://biowellth.ai/`, sign up through the final CTA. The done pill shows,
   then the "Want in sooner?" modal opens. The orb is large behind the card, and Move me up is visible
   without scrolling.
2. **Check that Skip sends nothing.** Close the modal with X. In DevTools Network there is no
   `/profile` request, and focus returns to the done pill.
3. **Check a save.** Sign up again with a second alias. Tap one chip ("Prefer not to say"), then Move
   me up. Expect `/profile` → 200 `{"ok":true}`, then "Thank you, you've moved up." in the modal.
4. **Read the database** through the connector, by email:
   - **Second alias:** `persona_tag = 'prefer_not_say'`, `priority = true`, `priority_at` set,
     `profile_token` null. Every other answer is null.
   - **First alias:** `priority = false`, and all four answers null.
5. **Check a phone.** Repeat step 1 at phone width, or on a phone. The card fills the screen with a
   12px inset and scrolls inside, and the page behind does not move.

- **Rollback:** the step 3 rollback. Then delete the test rows.

## 5. Delete the test rows

- **What:** `delete from public.waitlist where email in ('<alias 1>', '<alias 2>') returning id`,
  through the connector.
- **Verify:** select a count by those emails, which must be 0. Check that the total row count fell by
  exactly 2.
- **Rollback:** none. These are throwaway rows.

## After launch

- **Wave invites:** use only the invite query in backend `docs/waitlist-delete-request.md`, section B.
  It orders by priority, never by the answers.
- **Record the launch** in the backend handoff, with the commit, the function version, and the time
  the switch was set.
