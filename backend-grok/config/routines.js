// config/routines.js
// ============================================================
// FROM NEGATIVE — Daily Routine Engine
// ============================================================
// Builds the AM/PM "Daily Home Care Routine" shown in the PDF
// using ONLY From Negative products (Cica / Chamomile / Lip Mask),
// based on the conditions the AI detects.
//
// This REPLACES the generic routine the AI returns (which used to
// reference competitor products / random ingredients).
//
// Product lineup:
//   Cica       -> Cleanser, Toner, Serum
//   Chamomile  -> Toner, Serum
//   Lip Mask   -> standalone SKU
//
// HOW IT WORKS:
//   1. Detected conditions are mapped to canonical concern keys.
//   2. We try to match a COMBO routine (Part 2 of the guide) —
//      the most specific combo whose concerns are all present wins.
//   3. If no combo matches, we use the single highest-priority
//      concern's routine (Part 1 of the guide).
//   4. Optional SPF + Lip Mask steps are appended per the flags below.
// ============================================================

// ---- Toggles -------------------------------------------------
const ROUTINE_OPTIONS = {
  includeSPF: true,          // keep the SPF step at the end of every AM routine
  addLipMask: true,          // append the Lip Mask as a standalone step
  lipMaskWhenDryOnly: true,  // only add Lip Mask when dryness/dehydration is detected
};

// ---- Canonical concern detection ----------------------------
// Each canonical concern lists the substrings that map AI-detected
// issue text onto it. Order in PRIORITY decides single-concern ties.
const CONCERN_ALIASES = {
  acne:          ['acne', 'breakout', 'pimple', 'blemish', 'whitehead'],
  pie:           ['post-acne', 'post acne', 'pie', 'acne mark', 'acne scar', 'red mark'],
  blackheads:    ['blackhead', 'comedone', 'congestion'],
  redness:       ['redness', 'sensitiv', 'irritation', 'rosacea', 'inflamed'],
  enlargedPores: ['enlarged pore', 'large pore', 'pores', 'pore '],
  oiliness:      ['oily', 'oiliness', 'excess oil', 'excess sebum', 'sebum'],
  darkSpots:     ['dark spot', 'dark spots'],
  pigmentation:  ['pigmentation', 'hyperpigmentation', 'uneven tone', 'uneven texture', 'uneven skin', 'melasma'],
  tan:           ['tan', 'sun damage', 'sun spot', 'sunspot'],
  dullness:      ['dull', 'lack of radiance', 'lackluster'],
  wrinkles:      ['wrinkle'],
  fineLines:     ['fine line'],
  dryness:       ['dry', 'dehydrat', 'chapped', 'flaky', 'tight'],
};

// Priority order for choosing a SINGLE concern when no combo matches.
// Earlier = higher priority (chosen first on a severity tie).
const PRIORITY = [
  'acne', 'pie', 'redness', 'blackheads', 'enlargedPores',
  'darkSpots', 'pigmentation', 'tan', 'dullness', 'wrinkles', 'fineLines', 'dryness',
];

// ---- Single-concern routines (Part 1 of the guide) ----------
const SINGLE = {
  acne: {
    morning: ['Cica Cleanser', 'Cica Toner', 'Cica Serum', 'SPF'],
    evening: ['Cica Cleanser', 'Cica Toner', 'Cica Serum (double pump on active spots)'],
  },
  pie: {
    morning: ['Cica Cleanser', 'Cica Toner', 'Cica Serum', 'SPF'],
    evening: ['Cica Cleanser', 'Chamomile Toner', 'Cica Serum'],
  },
  enlargedPores: {
    morning: ['Cica Cleanser', 'Cica Toner', 'Cica Serum', 'SPF'],
    evening: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum'],
  },
  fineLines: {
    morning: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum', 'SPF'],
    evening: ['Cica Cleanser', 'Cica Toner', 'Cica Serum (double pump)'],
  },
  wrinkles: {
    morning: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum', 'SPF'],
    evening: ['Cica Cleanser', 'Cica Toner', 'Cica Serum (double pump)'],
  },
  darkSpots: {
    morning: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum', 'SPF PA++++'],
    evening: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum (double pump on spots)'],
  },
  pigmentation: {
    morning: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum', 'SPF'],
    evening: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum'],
  },
  dullness: {
    morning: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum', 'SPF'],
    evening: ['Cica Cleanser', 'Cica Toner', 'Chamomile Serum'],
  },
  redness: {
    morning: ['Cica Cleanser', 'Cica Toner', 'Cica Serum', 'Mineral SPF'],
    evening: ['Cica Cleanser', 'Chamomile Toner', 'Cica Serum'],
  },
  blackheads: {
    morning: ['Cica Cleanser', 'Chamomile Toner', 'Cica Serum', 'SPF'],
    evening: ['Double Cleanse (oil + Cica Cleanser)', 'Chamomile Toner', 'Chamomile Serum'],
  },
  tan: {
    morning: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum', 'SPF PA++++'],
    evening: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum (double pump)'],
  },
  oiliness: {
    morning: ['Cica Cleanser', 'Cica Toner', 'Chamomile Serum', 'SPF'],
    evening: ['Double Cleanse (oil + Cica Cleanser)', 'Chamomile Toner', 'Chamomile Serum'],
  },
  // No dedicated dryness routine in the guide — use a barrier-repair
  // Cica routine; the Lip Mask is added separately when dryness shows.
  dryness: {
    morning: ['Cica Cleanser', 'Cica Toner', 'Cica Serum', 'SPF'],
    evening: ['Cica Cleanser', 'Cica Toner', 'Cica Serum'],
  },
};

// ---- Combo routines (Part 2 of the guide) -------------------
// `requires` must ALL be present for the combo to match. The combo
// with the MOST required concerns wins (most specific); ties break
// on summed severity of the matched concerns.
const COMBOS = [
  {
    name: 'Full Reset (Acne + PIH + Dullness + Enlarged Pores)',
    requires: ['acne', 'darkSpots', 'dullness', 'enlargedPores'],
    morning: ['Cica Cleanser', 'Cica Toner', 'Cica Serum', 'SPF PA++++'],
    evening: ['Double Cleanse (oil + Cica Cleanser)', 'Chamomile Toner', 'Chamomile Serum'],
    weekly: 'PM only, 2-3x/week: add a gentle exfoliant after double cleanse, before toner.',
  },
  {
    name: 'Redness + Blackheads + Oily Skin',
    requires: ['redness', 'blackheads', 'oiliness'],
    morning: ['Cica Cleanser', 'Cica Toner', 'Chamomile Serum', 'SPF'],
    evening: ['Double Cleanse (oil + Cica Cleanser)', 'Chamomile Toner', 'Cica Serum'],
  },
  {
    name: 'Acne + Dark Spots (PIH)',
    requires: ['acne', 'darkSpots'],
    morning: ['Cica Cleanser', 'Cica Toner', 'Cica Serum', 'SPF PA++++'],
    evening: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum (on marks)', 'Cica Serum (on active zones)'],
  },
  {
    name: 'Acne + Post-Acne Redness',
    requires: ['acne', 'pie'],
    morning: ['Cica Cleanser', 'Cica Toner', 'Cica Serum', 'SPF'],
    evening: ['Cica Cleanser', 'Chamomile Toner', 'Cica Serum'],
  },
  {
    name: 'Pigmentation + Dullness',
    requires: ['pigmentation', 'dullness'],
    morning: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum', 'SPF'],
    evening: ['Cica Cleanser', 'Cica Toner', 'Chamomile Serum'],
  },
  {
    name: 'Fine Lines + Dark Spots',
    requires: ['fineLines', 'darkSpots'],
    morning: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum', 'SPF'],
    evening: ['Cica Cleanser', 'Cica Toner', 'Cica Serum + Chamomile Serum (alternate nights)'],
  },
  {
    name: 'Tan + Redness + Sensitive Skin',
    requires: ['tan', 'redness'],
    morning: ['Cica Cleanser', 'Chamomile Toner', 'Chamomile Serum', 'Mineral SPF'],
    evening: ['Cica Cleanser', 'Cica Toner', 'Chamomile Serum'],
  },
];

const SEVERITY_WEIGHT = { mild: 1, moderate: 2, severe: 3 };

// Pull every condition string the AI produced, with a severity weight.
function collectConditions(analysis) {
  const out = [];
  for (const issue of analysis.detectedIssues || []) {
    out.push({
      text: (issue.issue || '').toLowerCase(),
      weight: SEVERITY_WEIGHT[(issue.severity || '').toLowerCase()] || 2,
    });
  }
  for (const zone of Object.values(analysis.zoneAnalysis || {})) {
    for (const i of zone.issues || []) {
      out.push({ text: String(i).toLowerCase(), weight: 1 });
    }
  }
  return out;
}

// Map raw conditions onto canonical concern keys -> summed weight.
function detectConcerns(analysis) {
  const conditions = collectConditions(analysis);
  const weights = {};
  for (const [key, aliases] of Object.entries(CONCERN_ALIASES)) {
    for (const { text, weight } of conditions) {
      if (aliases.some(a => text.includes(a))) {
        weights[key] = (weights[key] || 0) + weight;
      }
    }
  }
  return weights; // e.g. { acne: 3, darkSpots: 2 }
}

// Append SPF / Lip Mask steps to a chosen routine per the toggles.
function decorate(routine, concerns) {
  const morning = [...routine.morning];
  const evening = [...routine.evening];

  if (!ROUTINE_OPTIONS.includeSPF) {
    const noSpf = s => !/spf/i.test(s);
    // keep only non-SPF steps (SPF only ever lives in the AM list)
    return finalize(morning.filter(noSpf), evening, routine.weekly);
  }

  const dry = concerns.dryness > 0 || concerns.tan > 0;
  const wantLip = ROUTINE_OPTIONS.addLipMask && (!ROUTINE_OPTIONS.lipMaskWhenDryOnly || dry);
  if (wantLip) {
    morning.push('Lip Mask (thin layer)');
    evening.push('Lip Mask (generous layer, leave overnight)');
  }

  return finalize(morning, evening, routine.weekly);
}

function finalize(morning, evening, weekly) {
  if (weekly) evening = [...evening, weekly];
  return { morning, evening };
}

// Choose the best routine for the detected concerns.
function selectRoutine(concerns) {
  const present = Object.keys(concerns);

  // 1) Best matching combo: most required concerns, then highest weight.
  let best = null;
  for (const combo of COMBOS) {
    if (!combo.requires.every(r => present.includes(r))) continue;
    const weight = combo.requires.reduce((s, r) => s + (concerns[r] || 0), 0);
    if (!best || combo.requires.length > best.size ||
        (combo.requires.length === best.size && weight > best.weight)) {
      best = { combo, size: combo.requires.length, weight };
    }
  }
  if (best) return best.combo;

  // 2) Single top concern: highest weight, then PRIORITY order.
  if (present.length) {
    present.sort((a, b) => {
      const dw = (concerns[b] || 0) - (concerns[a] || 0);
      if (dw !== 0) return dw;
      return PRIORITY.indexOf(a) - PRIORITY.indexOf(b);
    });
    const top = present.find(k => SINGLE[k]);
    if (top) return SINGLE[top];
  }

  // 3) Nothing detected — gentle Cica maintenance default.
  return SINGLE.acne;
}

/**
 * Build the From Negative AM/PM daily routine for an analysis result.
 * Returns { morning: string[], evening: string[] }.
 */
function buildRoutine(analysis) {
  const concerns = detectConcerns(analysis);
  const routine = selectRoutine(concerns);
  return decorate(routine, concerns);
}

module.exports = { buildRoutine, ROUTINE_OPTIONS };
