/**
 * CYCLE_MOVEMENT_V1 — the ONE place a cycle phase and a movement suggestion are decided.
 *
 * THIS FILE IS BYTE-IDENTICAL IN THREE REPOSITORIES:
 *   supa              supabase/functions/_shared/cycle-movement.js
 *   website           js/cycle-movement.js                          (daily card)
 *   backend-branches  src/services/cycle-movement.js                (Sana's <<CYCLE_MOVEMENT>> block)
 * Each suite pins its sha256 and that of the shared corpus (cycle-movement-corpus.json) to the SAME
 * constants, and asserts every corpus case resolves as labelled. Edit every copy and every pin
 * together, or none.
 *
 * Pure: plain JavaScript, no imports, no clock. TODAY IS AN INPUT, as her local calendar date, so
 * the same inputs give the same answer in Deno, Node and the browser. The engine decides the phase
 * and the movement line; a model may only repeat them.
 *
 * Rulings (docs/cycle-movement-orient-2026-10-12.md, section 7, approved 2026-10-12):
 *   R1 a missing period length defaults to 5 and is flagged; a missing cycle length gives no phase.
 *   R2 a cycle length outside 21-35 gives no phase.
 *   R3 current hormonal contraception gives no phase; an unreadable answer gives no phase.
 *   R4 irregular, PCOS, perimenopause give no phase, and the reason is never named in copy.
 *   R5 a self-reported absent period (amenorrheic, or a medical / not-sure reason) gives a gentle
 *      suggestion to raise it with a clinician. An old period date alone asks her to log one.
 *   R6 the LATER of the profile's current period date and the report's period date is used.
 *   R7 energy is optional; without it each phase has a default tier.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function dayNumber(ymd) {
  if (typeof ymd !== "string" || !YMD.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return Math.round(t / 86400000);
}

function ymdFromDayNumber(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

// DAYS_SINCE_V1 (2026-10-17). Whole days from the later usable period date (R6, the same rule and the
// same "ignored if malformed or in her future" filter the phase path uses below) to today. 0 on the
// day the period started, so cycleDay is daysSince + 1 wherever both exist. null with no usable date.
// Read ONLY by the out_of_range_inputs and overdue results; it decides nothing.
// DAYS_SINCE_V2 (2026-10-18): also the cycle_length_unknown result, same function, same rules.
function daysSinceLmp(p, o, todayN) {
  let best = null;
  for (const v of [p.last_period_start_date, o.reportLmp]) {
    const n = dayNumber(v);
    if (n !== null && n <= todayN && (best === null || n > best)) best = n;
  }
  return best === null ? null : todayN - best;
}

function intOrNull(v) {
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

export const CYCLE_LENGTH_MIN = 21;
export const CYCLE_LENGTH_MAX = 35;
export const PERIOD_LENGTH_MIN = 2;
export const PERIOD_LENGTH_MAX = 8;
export const PERIOD_LENGTH_DEFAULT = 5;
export const OVERDUE_GRACE_DAYS = 7;

/** Original copy. No colons, no em dashes, no exclamation marks, offer never instruct. */
export const MOVEMENT_LINES = Object.freeze({
  menstrual: Object.freeze({
    gentle: "A walk, some stretching or gentle yoga could suit today. Light resistance work is fine too.",
    moderate: "If you have energy today, a moderate session is a fine choice. A walk or a stretch works too.",
  }),
  follicular: Object.freeze({
    high: "A good window for strength work, heavier lifts or short intervals, at a level that suits you.",
    gentle: "If your energy is low today, a walk or an easy stretch is plenty. Strength work can wait.",
  }),
  early_luteal: Object.freeze({
    moderate: "Moderate cardio, yoga, a brisk walk or some flexibility work could suit this part of your cycle.",
  }),
  late_luteal: Object.freeze({
    moderate: "Let your energy lead today. A moderate session, like a brisk walk or an easy ride, is a good default.",
    high: "If you feel good today, a harder session is a fine choice. Ease off whenever your body asks you to.",
  }),
});

export const STATUS_LINES = Object.freeze({
  log_period: "Log your period to see movement ideas for where you are in your cycle.",
  cycle_length_unknown: "Add your usual cycle length to see movement ideas for your cycle.",
  raise_with_clinician:
    "A period that has stopped for three months or more is worth raising with a clinician.",
});

export const PHASE_LABELS = Object.freeze({
  menstrual: "Menstrual",
  follicular: "Follicular",
  early_luteal: "Early luteal",
  late_luteal: "Late luteal",
});

function tierFor(phase, energy) {
  if (phase === "menstrual") return energy === "high" ? "moderate" : "gentle";
  if (phase === "follicular") return energy === "low" ? "gentle" : "high";
  if (phase === "early_luteal") return "moderate";
  return energy === "high" ? "high" : "moderate";
}

function dailyCardKeyFor(phase, inOvulationWindow) {
  if (phase === "menstrual") return "menstrual";
  if (phase === "follicular") return inOvulationWindow ? "ovulatory" : "follicular";
  return "luteal";
}

function base(status, reason, extra) {
  return Object.assign(
    {
      version: "CYCLE_MOVEMENT_V1",
      status,
      reason,
      lmp: null,
      lmpSource: null,
      cycleDay: null,
      cycleLength: null,
      periodLength: null,
      inputsEstimated: { cycleLength: false, periodLength: false },
      phase: null,
      phaseLabel: null,
      inOvulationWindow: false,
      nextPeriodEstimate: null,
      dailyCardKey: null,
      movementTier: null,
      movementLine: null,
      statusLine: null,
    },
    extra || {},
  );
}

/**
 * profile: her `profiles` row (any subset of the cycle columns; absent keys read as unanswered).
 * opts.reportLmp: the latest report's `lmp_date_before_draw`, the read-both fallback (R6).
 * opts.today: her LOCAL calendar date, 'YYYY-MM-DD'. Required.
 * opts.energy: null | 'low' | 'ok' | 'high' (R7). Nothing captures it yet.
 * opts.contraceptionUnknown: true when the caller could not read the contraception answer (R3).
 */
export function resolveCycleMovement(profile, opts) {
  const p = profile || {};
  const o = opts || {};
  const todayN = dayNumber(o.today);
  if (todayN === null) return base("no_phase", "no_today");
  const energy = o.energy === "low" || o.energy === "ok" || o.energy === "high" ? o.energy : null;

  const ms = p.menstrual_status ?? null;
  const cs = p.cycle_status ?? null;
  const ls = p.life_stage ?? null;
  const ar = p.amenorrhea_reason ?? null;

  if (ms === "pregnant" || ls === "pregnant" || p.pregnant_or_postpartum_within_6_months === true) {
    return base("no_phase", "pregnant_or_postpartum");
  }
  if (ar === "breastfeeding") return base("no_phase", "pregnant_or_postpartum");
  if (ms === "postmenopausal" || ls === "postmenopause") return base("no_phase", "postmenopause");
  if (o.contraceptionUnknown === true) return base("no_phase", "contraception_unknown");
  if (
    p.hormonal_contraception === "current" ||
    p.on_hormonal_contraception === true ||
    ar === "hormonal_contraception"
  ) {
    return base("no_phase", "contraception");
  }
  if (p.hormone_therapy_status === "yes") return base("no_phase", "hormone_therapy");
  if (cs === "amenorrheic" || ar === "medical" || ar === "not_sure") {
    return base("raise_with_clinician", "amenorrhea", { statusLine: STATUS_LINES.raise_with_clinician });
  }
  if (ms === "perimenopausal" || ls === "perimenopause") return base("no_phase", "irregular");
  if (ms === "irregular" || cs === "irregular" || cs === "pcos" || cs === "none") {
    return base("no_phase", "irregular");
  }
  if (ms !== "regular") return base("no_phase", "cycle_status_unknown");

  const L = intOrNull(p.typical_cycle_length_days);
  if (L === null) {
    return base("no_phase", "cycle_length_unknown", { statusLine: STATUS_LINES.cycle_length_unknown, daysSince: daysSinceLmp(p, o, todayN) });
  }
  if (L < CYCLE_LENGTH_MIN || L > CYCLE_LENGTH_MAX) {
    return base("no_phase", "out_of_range_inputs", { daysSince: daysSinceLmp(p, o, todayN) });
  }

  let P = intOrNull(p.typical_period_duration_days);
  let periodEstimated = false;
  if (P === null) {
    P = PERIOD_LENGTH_DEFAULT;
    periodEstimated = true;
  } else if (P < PERIOD_LENGTH_MIN || P > PERIOD_LENGTH_MAX) {
    return base("no_phase", "out_of_range_inputs", { daysSince: daysSinceLmp(p, o, todayN) });
  }

  // R6: the later of the two, each ignored if malformed or in her future.
  const candidates = [];
  const profN = dayNumber(p.last_period_start_date);
  if (profN !== null && profN <= todayN) candidates.push({ n: profN, source: "profile" });
  const repN = dayNumber(o.reportLmp);
  if (repN !== null && repN <= todayN) candidates.push({ n: repN, source: "report" });
  const inputs = {
    cycleLength: L,
    periodLength: P,
    inputsEstimated: { cycleLength: false, periodLength: periodEstimated },
  };
  if (!candidates.length) {
    return base("log_period", "lmp_unknown", Object.assign({ statusLine: STATUS_LINES.log_period }, inputs));
  }
  candidates.sort((a, b) => b.n - a.n || (a.source === "profile" ? -1 : 1));
  const lmpN = candidates[0].n;
  const cycleDay = todayN - lmpN + 1;
  const withLmp = Object.assign({ lmp: ymdFromDayNumber(lmpN), lmpSource: candidates[0].source, cycleDay }, inputs);
  if (cycleDay > L + OVERDUE_GRACE_DAYS) {
    return base("log_period", "overdue", Object.assign({ statusLine: STATUS_LINES.log_period, daysSince: todayN - lmpN }, withLmp));
  }

  const ov = L - 14;
  let phase;
  if (cycleDay <= P) phase = "menstrual";
  else if (cycleDay <= ov + 1) phase = "follicular";
  else if (cycleDay <= L - 7) phase = "early_luteal";
  else phase = "late_luteal";
  const inOvulationWindow = phase === "follicular" && cycleDay >= ov - 1 && cycleDay <= ov + 1;
  const tier = tierFor(phase, energy);

  return base("phase", null, Object.assign(withLmp, {
    phase,
    phaseLabel: PHASE_LABELS[phase],
    inOvulationWindow,
    nextPeriodEstimate: ymdFromDayNumber(lmpN + L),
    dailyCardKey: dailyCardKeyFor(phase, inOvulationWindow),
    movementTier: tier,
    movementLine: MOVEMENT_LINES[phase][tier],
  }));
}
