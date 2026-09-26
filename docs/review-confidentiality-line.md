# Held-back copy: the reviewer confidentiality line

**Status: NOT SHIPPED.** Held on the founder's instruction on 2026-09-25 (REVIEW_GATE_COPY_V2). It may be added only after the reviewer confidentiality agreement is signed. Until then it would be a promise that nothing backs.

The exact wording:

> Reviewers work under a confidentiality agreement and see only what they need to check your report.

**Where it would go, once the agreement is signed:**

- the pending view body in `dashboard.html` (`#view-pending`);
- optionally, after `PFU_SAVED_B`.

**When it ships**, run it through the dashboard copy rules: no colons, no em or en dashes, and contractions kept.

**History.** Until 2026-09-26 this sentence sat in `dashboard.html` as a commented-out constant, `REVIEW_CONFIDENTIALITY_LINE`, with a pointer to it in the pending view's HTML comment. It was moved here so the served page carries no unshipped copy, even in a comment. `docs/` is excluded from the Pages build, so this file is not served.
