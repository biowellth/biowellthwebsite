# WAITLIST_STEP2_V1 deploy runbook

The ordered steps to ship step 2, each with its rollback. **Steps 1 to 4 were run on 2026-10-27 as a
dark ship**, on founder instruction and with the step-2 kill switch off. The record and the read-back
are in backend `docs/waitlist-step2-apply-2026-10-27.md`. **Steps 5 and 6 wait for counsel's reply.**
They are written out in `docs/waitlist-step2-launch-day.md`, which is the document to follow on the
day.

Project `clacgutnrktdwhglvyua` ("BioWellth Website", ap-south-1). Read it from backend
`supabase/.temp/project-ref`, never from memory. Every step takes the session lock in the repo it
writes.

## 1. Apply migration 0077 (DONE 2026-10-27)

- **What:** backend `migrations/0077_waitlist_step2.sql`. The Management API token is read-only, so
  the step runs through the claude.ai Supabase connector `apply_migration`, under a founder-approved
  brief, and the use is recorded in the dark-ship doc.
- **Verify:** read back the 9 columns, the 5 CHECKs, `waitlist_profile_token_key`, RLS on with 0
  policies, and `has_table_privilege` unchanged (`service_role` S/I/U/D only). Existing rows must be
  null or false in every new column.
- **Rollback:** the statement in the migration header. Drop the two constraints, then the index, then
  the nine columns. Roll back step 2 below first, or the function's insert select names a missing
  column.

## 2. Deploy waitlist-signup (DONE 2026-10-27, v8)

- **What:** push backend `main` first, so the deployed source is on origin. Then run
  `supabase functions deploy waitlist-signup --project-ref clacgutnrktdwhglvyua`, always with the
  function name. `verify_jwt = false` comes from `config.toml`.
- **Verify:** `list_edge_functions` shows the new version with `verify_jwt` false. One other function
  is the canary and must be unchanged: `process-report-worker` v151, `c684b10d…`.
- **Rollback:** redeploy the previous source by name. Check out the prior commit of
  `supabase/functions/waitlist-signup/` (v7 was `a14c901`), deploy it, and return the tree to `main`.

## 3. Verify the old client is unaffected (DONE 2026-10-27)

- **What:** with the switch off, the response must have the pre-0077 shape. Any client then behaves as
  before.
- **Verify:**
  1. POST a signup with a throwaway `+alias` of the founder's Gmail. Expect `{"ok":true,"notice":"inbox"}`
     and no `step2` key.
  2. POST `/profile` with the body `not json`. Expect `{"ok":true}`. That is the off discriminator: v7
     answers 404 and on answers 400.
  3. Control: an invalid email still gets 400.
  4. Confirm 0 rows have any step-2 write, then delete the test row.
- **Rollback:** step 2's rollback.

## 4. Push the website (DONE 2026-10-27, `7552667`)

- **What:** push `main`, with `git push`, never forced.
- **Verify:**
  - Curl `https://biowellth.ai/` until `last-modified` is fresh.
  - Grep for `id="wl-modal"` (a marker for these commits). The controls are 3 × `data-wl="inline-v1"`
    and no `wl-step2-tpl`.
  - Run `node scripts/check-live-exclusions.mjs` (596 of 596 that day).
  - Make one real signup on the live site: the done pill shows and no modal opens. Then delete that
    row.
- **Rollback:** `git revert` the WAITLIST_STEP2_V1 commits and push. With the switch off, the live
  modal code is inert, so this rollback is only needed for a regression in step 1.

## 5. Publish privacy policy v1.5 (WAITS FOR COUNSEL)

See `docs/waitlist-step2-launch-day.md`, step 2. Publishing comes before step 6, never after: no
answer is collected under a policy that does not describe it.

## 6. Switch step 2 on and smoke test (WAITS FOR COUNSEL)

See `docs/waitlist-step2-launch-day.md`, steps 3 to 5. **Rollback: unset `WAITLIST_STEP2_ENABLED`.**
No redeploy is needed, because the switch is read per request.
