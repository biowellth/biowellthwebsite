// FOOD_GUARD_V1 — a deterministic check on generated food suggestions. Ruled 2026-10-20: BioWellth never
// suggests red meat, in any form, including advice to limit or cut back on it. Food suggestions are
// vegetarian and India-coded. Eggs, fish and chicken appear only for a diet that allows them.
//
// ONE FILE, BYTE-IDENTICAL, PINNED BY SHA256 in two places:
//   supa     supabase/functions/_shared/food-guard.js   (write time, process-report-worker Call D and Call B)
//   website  js/food-guard.js                           (render time, the daily card)
// Edit one copy without the other and that repository goes red.
//
// WHY A LEXICON. The rule is about words a woman reads, so the rule is the words. Whole-word and
// case-insensitive, so "lambda", "goatee", "porkbun", "hamstring" and "eggplant" pass. "non-heme iron"
// is the vegetarian iron and is stripped before matching, so the heme-iron ban cannot eat it; plant milks
// and nut butters are stripped the same way before the vegan dairy check. No lookbehind, so the file
// parses in older Safari.
//
// THE DIET. foodCategory(text, diet) takes the profile's vegetarian_status, or null. Red meat is banned
// under every diet. Null, empty and any unrecognised value read as Vegetarian, the strictest reading that
// still allows dairy; Vegan adds dairy. Phase 1 passes null everywhere, so everyone gets that reading.
//
// DROP, NEVER REWRITE. Applied with the prevalence-guard rules: a hit in base_text drops the whole
// action, a hit in a phase note drops only that note (null when none is left), and an unscannable row is
// dropped because the guard cannot vouch for it. A list (Call B supporting_levers) loses only the item.
//
// NOTHING HERE LOGS TEXT. A drop records the action id, the field and the category, never the sentence.
//
// Pure ES module, no imports: it runs unchanged in Deno (supa) and in the browser (website).

export const FOOD_GUARD_VERSION = "FOOD_GUARD_V1";

// Categories, in the order they are checked. red_meat is never allowed.
export const FOOD_CATEGORIES = ["red_meat", "egg", "fish_poultry", "dairy"];

// The banned words per category, as written in the rule. Each is matched as a whole word, singular or
// with a trailing s, case-insensitive; a space also matches a hyphen ("red-meat", "heme-iron").
export const FOOD_TERMS = {
  red_meat: [
    "beef", "pork", "mutton", "lamb", "goat", "red meat", "meat", "veal", "venison", "steak", "bacon", "ham",
    "sausage", "salami", "pepperoni", "gosht", "keema", "kheema", "organ meat", "heme iron", "heme source",
  ],
  egg: ["egg", "omelette", "omelet", "anda"],
  fish_poultry: [
    "fish", "chicken", "poultry", "seafood", "shellfish", "prawn", "shrimp", "crab", "lobster", "oyster", "mussel",
    "squid", "sardine", "mackerel", "bangda", "tuna", "salmon", "rohu", "hilsa", "pomfret", "surmai", "cod",
    "turkey", "duck",
  ],
  dairy: [
    "paneer", "curd", "dahi", "yogurt", "yoghurt", "milk", "ghee", "butter", "cheese", "buttermilk", "chaas",
    "lassi", "raita", "khoa", "khoya", "cream",
  ],
};

// Which categories each diet allows. Keys are normalised diet values.
const ALLOWED = {
  vegetarian: ["dairy"],
  vegan: [],
  eggetarian: ["dairy", "egg"],
  "mostly vegetarian": ["dairy", "egg", "fish_poultry"],
  "non-vegetarian": ["dairy", "egg", "fish_poultry"],
};

function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termRe(term) {
  return new RegExp("\\b" + term.split(" ").map(escapeForRegex).join("[\\s-]+") + "s?\\b", "i");
}

const MATCHERS = FOOD_CATEGORIES.map((category) => ({ category, res: FOOD_TERMS[category].map(termRe) }));

// Vegetarian phrases that contain a banned word. Removed before matching, never from the stored text.
const NON_HEME_RE = /\bnon[\s-]*heme\b/gi;
const PLANT_DAIRY_RE = /\b(coconut|soy|soya|almond|oat|rice|cashew|peanut|plant|nut|seed|sesame|sunflower|cocoa|shea)[\s-]+(milk|curd|dahi|yogurt|yoghurt|cheese|butter|cream)s?\b/gi;
const NUT_MILK_RE = /\b(nut|plant)[\s-]*based[\s-]+(milk|curd|yogurt|yoghurt|cheese|butter|cream)s?\b/gi;

/**
 * The normalised diet: one of the ALLOWED keys. Null, empty or anything unrecognised is "vegetarian",
 * the strictest reading that still allows dairy.
 */
export function normalizeDiet(diet) {
  if (typeof diet !== "string") return "vegetarian";
  const d = diet.trim().toLowerCase().replace(/[\s_]+/g, " ").replace(/\s*-\s*/g, "-");
  if (d === "non vegetarian" || d === "non-vegetarian") return "non-vegetarian";
  if (d === "mostly vegetarian" || d === "mostly-vegetarian") return "mostly vegetarian";
  if (d === "vegetarian" || d === "vegan" || d === "eggetarian") return d;
  return "vegetarian";
}

/**
 * The category that bans this text under this diet, or null to keep it. Non-string text is
 * "unscannable" and empty text is null (nothing is suggested).
 */
export function foodCategory(text, diet) {
  if (typeof text !== "string") return "unscannable";
  if (text.trim() === "") return null;
  const allowed = ALLOWED[normalizeDiet(diet)];
  const scan = text.replace(NON_HEME_RE, " ").replace(PLANT_DAIRY_RE, " ").replace(NUT_MILK_RE, " ");
  for (const m of MATCHERS) {
    if (m.category !== "red_meat" && allowed.includes(m.category)) continue;
    for (const re of m.res) if (re.test(scan)) return m.category;
  }
  return null;
}

/** True when the text may be shown under this diet. */
export function foodAllowed(text, diet) {
  return foodCategory(text, diet) === null;
}

/**
 * Apply the guard to a batch of Call D rows ({ action_id, base_text, phase_notes }). Never throws.
 * Returns { rows, drops }, drops being [{ action_id, field, category }] and never the text.
 */
export function applyFoodGuard(rows, diet) {
  const out = [];
  const drops = [];
  if (!Array.isArray(rows)) return { rows: out, drops };
  for (const row of rows) {
    let id = "unknown_action";
    try {
      if (!row || typeof row !== "object") { drops.push({ action_id: id, field: "row", category: "unscannable" }); continue; }
      id = typeof row.action_id === "string" && row.action_id ? row.action_id : "unknown_action";
      const baseHit = foodCategory(row.base_text, diet);
      if (baseHit) { drops.push({ action_id: id, field: "base_text", category: baseHit }); continue; }
      const pn = row.phase_notes;
      if (pn && typeof pn === "object" && !Array.isArray(pn)) {
        const kept = {};
        let removed = false;
        for (const [key, value] of Object.entries(pn)) {
          const hit = foodCategory(value, diet);
          if (hit) { drops.push({ action_id: id, field: "phase_notes." + key, category: hit }); removed = true; continue; }
          kept[key] = value;
        }
        if (removed) { out.push({ ...row, phase_notes: Object.keys(kept).length ? kept : null }); continue; }
      }
      out.push(row);
    } catch (_e) {
      drops.push({ action_id: id, field: "guard_error", category: "unscannable" });
    }
  }
  return { rows: out, drops };
}

/**
 * Filter a list of strings (Call B action_layer.supporting_levers). Returns { items, drops }: the kept
 * items in order, and [{ index, category }] for each removed one. A non-array comes back unchanged.
 */
export function filterFoodItems(items, diet) {
  if (!Array.isArray(items)) return { items, drops: [] };
  const kept = [];
  const drops = [];
  items.forEach((item, index) => {
    const category = foodCategory(item, diet);
    if (category) drops.push({ index, category });
    else kept.push(item);
  });
  return { items: kept, drops };
}

/** One log line per Call D drop, carrying no generated text. */
export function formatFoodGuardDrop(d) {
  return "[call_d] " + FOOD_GUARD_VERSION + " dropped " + d.field + " on action " + d.action_id + " (category " + d.category + ")";
}
