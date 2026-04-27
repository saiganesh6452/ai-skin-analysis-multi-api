// config/brandedProducts.js
// ============================================================
// FROM NEGATIVE — Branded Product Catalog
// ============================================================
// Edit this file to add/remove/update your branded products.
// These products will be recommended alongside AI-detected conditions.
//
// Each product should have:
//   - type: Category (e.g., "Cleanser", "Serum", "Moisturizer", "Sunscreen", "Toner", "Mask", "Eye Cream")
//   - name: Your product name
//   - brand: Your brand name (shown in report)
//   - description: What the product does
//   - usage: How often to use (e.g., "Twice daily", "Every morning")
//   - keyIngredient: Hero ingredient
//   - url: (Optional) Link to purchase
//   - targetConditions: Array of skin conditions this product helps with.
//       The AI detects conditions like: "acne", "hyperpigmentation", "dark spots",
//       "wrinkles", "fine lines", "dryness", "oiliness", "redness", "dark circles",
//       "uneven texture", "enlarged pores", "sun damage", "dehydration", "dullness"
//       Use "all" to always recommend regardless of condition.
// ============================================================

const BRANDED_PRODUCTS = [

  {
    type: "Serum",
    name: "Chamomile Vitamin C & Alpha Arbutin Face Serum",
    brand: "From Negative",
    description: "Brightening serum with Chamomile, Vitamin C, and Alpha Arbutin that fades dark spots, evens skin tone, and delivers a radiant glow without irritation.",
    usage: "Once daily AM",
    keyIngredient: "Vitamin C + Alpha Arbutin",
    url: "https://www.fromnegative.com/products/chamomile-vitamin-c-serum",
    targetConditions: ["hyperpigmentation", "dark spots", "dullness", "uneven texture", "sun damage"]
  },

  {
    type: "Toner",
    name: "Chamomile Vitamin C Toner Mist",
    brand: "From Negative",
    description: "Brightening and hydrating toner mist with Chamomile and Vitamin C. Preps skin for better serum absorption and boosts radiance with every spritz.",
    usage: "Twice daily after cleansing",
    keyIngredient: "Vitamin C + Chamomile Extract",
    url: "https://www.fromnegative.com/products/chamomile-vitamin-c-toner",
    targetConditions: ["dullness", "hyperpigmentation", "dehydration", "uneven texture"]
  },

  {
    type: "Serum",
    name: "Cica Niacinamide Face Serum 5%",
    brand: "From Negative",
    description: "Calming serum with CICA and 5% Niacinamide that repairs the skin barrier, reduces redness, fades acne marks, and controls excess oil.",
    usage: "Once daily PM",
    keyIngredient: "CICA + Niacinamide 5%",
    url: "https://www.fromnegative.com/products/cica-niacinamide-face-serum",
    targetConditions: ["acne", "redness", "oiliness", "enlarged pores", "uneven texture", "dark spots"]
  },

  {
    type: "Toner",
    name: "Cica Niacinamide Face Toner Mist",
    brand: "From Negative",
    description: "Calming and hydrating toner mist with CICA and Niacinamide. Soothes irritation, reduces redness, and preps skin for the rest of your routine.",
    usage: "Twice daily after cleansing",
    keyIngredient: "CICA + Niacinamide",
    url: "https://www.fromnegative.com/products/cica-niacinamide-face-toner",
    targetConditions: ["redness", "acne", "oiliness", "dehydration"]
  },

  {
    type: "Mask",
    name: "Nourishing Raspberry Shea Butter Lip Mask",
    brand: "From Negative",
    description: "Overnight lip mask with Raspberry and Shea Butter that deeply nourishes, repairs dry and chapped lips, and leaves them soft and plump by morning.",
    usage: "Nightly as last step",
    keyIngredient: "Raspberry Extract + Shea Butter",
    url: "https://www.fromnegative.com/products/raspberry-lip-mask",
    targetConditions: ["dryness", "dehydration"]
  },

  {
    type: "Kit",
    name: "The Sensitive Skin Kit",
    brand: "From Negative",
    description: "Complete routine kit for sensitive skin — calms, hydrates, and strengthens the skin barrier with CICA and Chamomile formulas working together.",
    usage: "Morning & evening routine",
    keyIngredient: "CICA + Chamomile + Niacinamide",
    url: "https://www.fromnegative.com/products/calm-hydrate-barrier-routine",
    targetConditions: ["redness", "dryness", "dehydration", "acne"]
  },

  {
    type: "Kit",
    name: "The Barrier Repair Kit",
    brand: "From Negative",
    description: "Targeted routine kit to repair a damaged skin barrier, calm breakouts, and restore balance — ideal for acne-prone and reactive skin types.",
    usage: "Morning & evening routine",
    keyIngredient: "CICA + Niacinamide + Alpha Arbutin",
    url: "https://www.fromnegative.com/products/acne-calm-repair-routine",
    targetConditions: ["acne", "redness", "enlarged pores", "oiliness", "uneven texture"]
  },

  {
    type: "Kit",
    name: "The Dryness Duo",
    brand: "From Negative",
    description: "A power pair of serum and toner designed to deeply hydrate, lock in moisture, and restore suppleness to dry and dehydrated skin.",
    usage: "Morning & evening routine",
    keyIngredient: "Hyaluronic Acid + Chamomile",
    url: "https://www.fromnegative.com/products/the-dryness-duo",
    targetConditions: ["dryness", "dehydration", "fine lines"]
  },

  {
    type: "Kit",
    name: "The Barrier Duo",
    brand: "From Negative",
    description: "Dual-action skin barrier formula that strengthens, soothes, and protects — reducing sensitivity and keeping skin resilient against environmental stressors.",
    usage: "Daily AM & PM",
    keyIngredient: "CICA + Ceramide-boosting actives",
    url: "https://www.fromnegative.com/products/the-barrier-duo",
    targetConditions: ["redness", "dryness", "dehydration", "uneven texture"]
  },

  {
    type: "Kit",
    name: "The Skin Reset System",
    brand: "From Negative",
    description: "Complete skin reset system combining brightening, calming, and barrier-repair actives for a full skin transformation — ideal for all skin concerns.",
    usage: "Full AM & PM routine",
    keyIngredient: "Vitamin C + CICA + Niacinamide",
    url: "https://www.fromnegative.com/products/complete-skin-balance-system",
    targetConditions: ["all"]
  }

];

// ============================================================
// HOW MATCHING WORKS:
// After AI analysis, the system checks each detected issue
// against the targetConditions of each branded product.
// Matching products replace the generic AI recommendations.
// Products with "all" in targetConditions are always included.
//
// MAX_PRODUCTS controls how many products appear in the report.
// ============================================================
const MAX_PRODUCTS = 6;

module.exports = { BRANDED_PRODUCTS, MAX_PRODUCTS };
