// services/skinAnalysis.js
const OpenAI = require('openai');
const config = require('../config');
const { BRANDED_PRODUCTS, MAX_PRODUCTS } = require('../config/brandedProducts');

const grok = new OpenAI({
  apiKey: config.ai.apiKey || 'dummy-key-for-startup',
  baseURL: config.ai.baseURL,
});

const ANALYSIS_PROMPT = `You are an expert dermatologist. Analyze this facial image thoroughly. Respond ONLY with raw JSON (no markdown, no backticks, no extra text).

{
  "skinType": "combination",
  "overallScore": 75,
  "summary": "Detailed 3-4 sentence assessment.",
  "detectedIssues": [{"issue":"Name","severity":"mild","description":"2-3 sentences.","affected_areas":["area1"]}],
  "zoneAnalysis": {
    "forehead":{"condition":"good","issues":[],"score":7,"detail":"2 sentences."},
    "nose":{"condition":"fair","issues":["issue"],"score":6,"detail":"2 sentences."},
    "leftCheek":{"condition":"good","issues":[],"score":8,"detail":"2 sentences."},
    "rightCheek":{"condition":"good","issues":[],"score":8,"detail":"2 sentences."},
    "chin":{"condition":"fair","issues":["issue"],"score":6,"detail":"2 sentences."},
    "aroundEyes":{"condition":"concerning","issues":["issue"],"score":5,"detail":"2 sentences."},
    "aroundMouth":{"condition":"good","issues":[],"score":7,"detail":"2 sentences."}
  },
  "productRecommendations": [
    {"type":"Cleanser","name":"Product Name","description":"Description.","usage":"Twice daily","keyIngredient":"Ingredient"},
    {"type":"Serum","name":"Product Name","description":"Description.","usage":"Once daily AM","keyIngredient":"Ingredient"},
    {"type":"Moisturizer","name":"Product Name","description":"Description.","usage":"Twice daily","keyIngredient":"Ingredient"},
    {"type":"Sunscreen","name":"Product Name","description":"Description.","usage":"Every morning","keyIngredient":"SPF 50"}
  ],
  "treatmentRecommendations": [{"treatment":"Name","purpose":"Purpose","frequency":"Frequency","notes":"Notes"}],
  "homeCareRoutine": {"morning":["Step 1","Step 2","Step 3"],"evening":["Step 1","Step 2","Step 3","Step 4"]},
  "lifestyleSuggestions": {"diet":["Suggestion"],"sleep":["Suggestion"],"habits":["Suggestion"]},
  "progressTimeline": {"week1":"Expected changes","week4":"Expected changes","week12":"Expected changes"}
}

IMPORTANT: Tailor productRecommendations to detected conditions. Include 4-6 products with real ingredient types and concentrations.`;

function matchBrandedProducts(analysis) {
  const detected = (analysis.detectedIssues || [])
    .map(i => (i.issue || '').toLowerCase());
  const zones = Object.values(analysis.zoneAnalysis || {})
    .flatMap(z => (z.issues || []).map(i => i.toLowerCase()));
  const allConditions = [...new Set([...detected, ...zones])];

  const scored = BRANDED_PRODUCTS.map(p => {
    const isAlways = p.targetConditions.includes('all');
    const matches = p.targetConditions.filter(c =>
      c !== 'all' && allConditions.some(d => d.includes(c) || c.includes(d))
    ).length;
    return { ...p, score: isAlways ? 1 + matches : matches };
  });

  const matched = scored
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PRODUCTS);

  return matched.map(({ score, targetConditions, ...p }) => p);
}

async function analyzeSkin(base64Image) {
  try {
    const res = await grok.chat.completions.create({
      model: config.ai.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          { type: 'text', text: ANALYSIS_PROMPT },
        ],
      }],
      max_tokens: config.ai.maxTokens,
    });

    let txt = res.choices[0].message.content.trim();
    txt = txt.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

    if (!txt.startsWith('{')) {
      const s = txt.indexOf('{');
      const e = txt.lastIndexOf('}');
      if (s !== -1 && e !== -1) txt = txt.substring(s, e + 1);
    }

    try {
      const analysis = JSON.parse(txt);
      analysis.productRecommendations = matchBrandedProducts(analysis);
      return { success: true, analysis };
    } catch {
      return { success: false, error: 'AI response was not valid JSON' };
    }
  } catch (e) {
    console.error('[Grok] Error:', e.message);
    return { success: false, error: e.message };
  }
}

module.exports = { analyzeSkin };
