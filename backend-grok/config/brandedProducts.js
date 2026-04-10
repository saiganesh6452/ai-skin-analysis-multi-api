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
  // ── EXAMPLE PRODUCTS — Replace these with your actual products ──

  {
    type: "Cleanser",
    name: "Negative Purifying Gel Cleanser",
    brand: "From Negative",
    description: "A gentle yet effective gel cleanser that removes impurities without stripping the skin barrier. Formulated for all skin types.",
    usage: "Twice daily",
    keyIngredient: "Niacinamide 2%",
    url: "https://www.fromnegative.com/",
    targetConditions: ["all"]
  },
  {
    type: "Serum",
    name: "Negative Brightening Vitamin C Serum",
    brand: "From Negative",
    description: "High-potency vitamin C serum that targets dark spots, uneven tone, and dullness for a radiant complexion.",
    usage: "Once daily AM",
    keyIngredient: "Vitamin C 15%",
    url: "https://www.fromnegative.com/",
    targetConditions: ["hyperpigmentation", "dark spots", "dullness", "uneven texture", "sun damage"]
  },
  {
    type: "Serum",
    name: "Negative Anti-Aging Retinol Serum",
    brand: "From Negative",
    description: "Advanced retinol formula that reduces fine lines, wrinkles, and improves skin texture while minimizing irritation.",
    usage: "Once daily PM",
    keyIngredient: "Retinol 0.5%",
    url: "https://www.fromnegative.com/",
    targetConditions: ["wrinkles", "fine lines", "uneven texture", "enlarged pores"]
  },
  {
    type: "Moisturizer",
    name: "Negative Hydra Barrier Cream",
    brand: "From Negative",
    description: "Lightweight moisturizer that strengthens the skin barrier and provides 24-hour hydration without clogging pores.",
    usage: "Twice daily",
    keyIngredient: "Ceramides + Hyaluronic Acid",
    url: "https://www.fromnegative.com/",
    targetConditions: ["dryness", "dehydration", "redness", "all"]
  },
  {
    type: "Sunscreen",
    name: "Negative Invisible Shield SPF 50",
    brand: "From Negative",
    description: "Ultra-light, non-greasy sunscreen with broad-spectrum protection. Leaves no white cast and works under makeup.",
    usage: "Every morning",
    keyIngredient: "SPF 50 PA++++",
    url: "https://www.fromnegative.com/",
    targetConditions: ["all"]
  },
  {
    type: "Toner",
    name: "Negative Pore Refining Toner",
    brand: "From Negative",
    description: "Exfoliating toner with BHA that unclogs pores, controls oil, and smooths skin texture.",
    usage: "Once daily PM",
    keyIngredient: "Salicylic Acid 2%",
    url: "https://www.fromnegative.com/",
    targetConditions: ["acne", "oiliness", "enlarged pores", "uneven texture"]
  },
  {
    type: "Eye Cream",
    name: "Negative Revive Eye Complex",
    brand: "From Negative",
    description: "Targeted eye treatment that reduces dark circles, puffiness, and fine lines around the delicate eye area.",
    usage: "Twice daily",
    keyIngredient: "Peptides + Caffeine",
    url: "https://www.fromnegative.com/",
    targetConditions: ["dark circles", "wrinkles", "fine lines"]
  },
  {
    type: "Mask",
    name: "Negative Deep Detox Clay Mask",
    brand: "From Negative",
    description: "Weekly treatment mask that draws out impurities, absorbs excess oil, and tightens pores for clearer skin.",
    usage: "1-2 times per week",
    keyIngredient: "Kaolin Clay + Charcoal",
    url: "https://www.fromnegative.com/",
    targetConditions: ["acne", "oiliness", "enlarged pores"]
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
