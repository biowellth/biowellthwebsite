// PHASE_NOTE_GUARD_V1 — a deterministic check on Call D's phase notes, the one piece of model prose
// the daily card shows under a cycle phase.
//
// ONE FILE, BYTE-IDENTICAL, PINNED BY SHA256 in two places:
//   supa     supabase/functions/_shared/phase-note-guard.js   (write time, process-report-worker)
//   website  js/phase-note-guard.js                           (render time, dcFlavorFor)
// with one hand-labelled corpus beside it. Edit one copy without the other and that repository goes red.
//
// WHY A LEXICON AND NOT A CLAIM DETECTOR. A flavor line exists to tune a food or movement action to the
// day. A note that names a body state, a symptom, an organ or what a phase "often" does to women has left
// that job, whatever verb joins the words, so the rule is the words. Co-occurrence (food word + body word)
// was rejected: it misses "Sleep often feels more fragmented in the luteal phase", which names no food.
//
// DROP, NEVER REWRITE. A flagged note is removed and the action stands; when no note is left the
// action's phase_notes is null, the shape an unphased action already has. An unreadable note is dropped
// too: the guard cannot vouch for it.
//
// NOTHING HERE LOGS NOTE TEXT. Callers log categories and counts only.
//
// Pure ES module, no imports: it runs unchanged in Deno (supa) and in the browser (website).

export const PHASE_NOTE_GUARD_VERSION = "PHASE_NOTE_GUARD_V1";

// The module's banned copy, the SAME list as cycle-movement-corpus.json `banned_copy` (both suites
// assert the two are equal). Applied here on word boundaries, which the module's own substring lint
// does not need because it only ever reads authored lines.
export const BANNED_COPY = [
  "deplet", "drain", "endometriosis", "pcos", "pms", "cancer", "induce", "body fat", "abs ",
  "many women", "most women", "common", "normal range", "diagnos", "should", "must", "need to",
  "have to", ":", "—", "!",
];

const COPY_RES = [
  /\bdeplet/i, /\bdrain/i, /\bendometriosis\b/i, /\bpcos\b/i, /\bpms\b/i, /\bcancer/i, /\binduc/i,
  /\bbody fat\b/i, /\babs\b/i, /\b(many|most) women\b/i, /\bcommon(ly)?\b/i, /\bnormal range\b/i,
  /\bdiagnos/i, /\bshould\b/i, /\bmust\b/i, /\bhave to\b/i, /:/, /—/, /!/,
];
// "need to" is an instruction; "no need to" is its opposite, and stays.
const NEED_TO_RE = /\bneed to\b/i;
const NO_NEED_TO_RE = /\bno need to\b/gi;

const GENERALIZATION_RE = /\b(often|usually|typically|typical|sometimes|commonly|common)\b|\btends? to\b|\b(many|most|some) (women|people)\b|\bmany (of us )?(feel|notice|find|experience)\w*/i;

const CONDITION_RE = /\b(thyroid|adrenal|liver|kidney|ovar(y|ies|ian)|uter(us|ine)|insulin|blood sugar|glucose|an(a)?emi\w*|diabet\w*|depress\w*|anxi\w*|migraine|endometriosis|pcos|fibroid)/i;

// A body state named, or a claim that something helps or supports "your body".
const BODY_STATE_RE = /\b(mood\w*|craving\w*|bloat\w*|cramp\w*|fatigue\w*|sluggish\w*|stress\w*|irritab\w*|sleep\w*|appetite|hunger|hormon\w*|inflamm\w*|symptom\w*|pain|painful|pms|premenstrual|digest\w*)\b|\b(help|helps|helping|support|supports|supporting)\s+your body\b/i;

// ENERGY, ruled 2026-10-12: dropped only when a relief or support verb acts on it ("help with energy",
// "boost your energy", "an energy boost", "energizing"), or beside a generalization (caught above).
// A conditional, state-led use stays: "If your energy is low today", "when energy is lower".
const ENERGY_SUPPORT_RE = /\b(help|helps|helping|boost|boosts|boosting|steady|steadies|steadying|support|supports|supporting|lift|lifts|lifting|restore|restores|restoring|replenish\w*|fuel|fuels|fueling|sustain|sustains|sustaining|improve|improves|improving|increase|increases|increasing|raise|raises|raising|balance|balances|balancing)\b[^.;,!?]{0,40}\benerg/i;
const ENERGY_NOUN_RE = /\benerg\w*[\s-]+(boost|lift)\w*|\benergi[sz]\w*/i;

/** The category that drops this note, or null to keep it. Order: copy, generalization, condition, body_state, energy. */
export function phaseNoteCategory(text) {
  if (typeof text !== "string") return "unscannable";
  if (text.trim() === "") return "empty";
  for (const re of COPY_RES) if (re.test(text)) return "copy";
  if (NEED_TO_RE.test(text.replace(NO_NEED_TO_RE, ""))) return "copy";
  if (GENERALIZATION_RE.test(text)) return "generalization";
  if (CONDITION_RE.test(text)) return "condition";
  if (BODY_STATE_RE.test(text)) return "body_state";
  if (ENERGY_SUPPORT_RE.test(text) || ENERGY_NOUN_RE.test(text)) return "energy";
  return null;
}

/** True when the note may be shown. */
export function phaseNoteAllowed(text) {
  return phaseNoteCategory(text) === null;
}

/**
 * Filter one action's phase_notes. Returns { notes, drops }: notes is the kept object, or null when
 * nothing is left; drops is [{ key, category }], never the text. Never throws.
 */
export function filterPhaseNotes(pn) {
  if (pn === null || pn === undefined) return { notes: null, drops: [] };
  if (typeof pn !== "object" || Array.isArray(pn)) return { notes: null, drops: [{ key: "*", category: "unscannable" }] };
  /** @type {Record<string, unknown>} */
  const kept = {};
  /** @type {{ key: string, category: string }[]} */
  const drops = [];
  for (const [key, value] of Object.entries(pn)) {
    const category = phaseNoteCategory(value);
    if (category) drops.push({ key, category });
    else kept[key] = value;
  }
  return { notes: Object.keys(kept).length ? kept : null, drops };
}

/**
 * Apply the guard to a batch of Call D rows. NEVER drops an action and never throws: a row whose scan
 * fails keeps its action with phase_notes null. Returns { rows, dropped, byCategory }.
 */
export function applyPhaseNoteGuard(rows) {
  const out = [];
  /** @type {Record<string, number>} */
  const byCategory = {};
  let dropped = 0;
  if (!Array.isArray(rows)) return { rows: out, dropped, byCategory };
  for (const row of rows) {
    try {
      if (!row || typeof row !== "object" || row.phase_notes === null || row.phase_notes === undefined) { out.push(row); continue; }
      const f = filterPhaseNotes(row.phase_notes);
      for (const d of f.drops) { dropped++; byCategory[d.category] = (byCategory[d.category] || 0) + 1; }
      out.push(f.drops.length ? { ...row, phase_notes: f.notes } : row);
    } catch (_e) {
      // Copy field by field, skipping phase_notes and any field that cannot be read, so the
      // error path itself cannot throw; the action stands with no note.
      dropped++; byCategory.guard_error = (byCategory.guard_error || 0) + 1;
      /** @type {Record<string, unknown>} */
      const safe = {};
      try { for (const k of Object.keys(row)) { if (k === "phase_notes") continue; try { safe[k] = row[k]; } catch (_e2) { /* unreadable field */ } } } catch (_e3) { /* unreadable row */ }
      safe.phase_notes = null;
      out.push(safe);
    }
  }
  return { rows: out, dropped, byCategory };
}

/** One log line per report: counts and categories, never note text. */
export function formatPhaseNoteGuardLog(reportId, result) {
  const cats = Object.keys(result.byCategory).sort().map((k) => k + "=" + result.byCategory[k]).join(", ");
  return "[call_d] " + PHASE_NOTE_GUARD_VERSION + " dropped " + result.dropped + " phase note(s) for report " + String(reportId) + (cats ? " (" + cats + ")" : "");
}
