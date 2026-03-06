// server.js — Skin Analysis Backend + Professional PDF
// PDF uses PDFKit with strict WinAnsi-safe text and proper visual design.
// Matches the web UI quality: circular gauge, cards, clean typography.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const OpenAI = require('openai');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: "https://api.x.ai/v1"
});

// ── Image Quality ──
async function analyzeImageQuality(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    const stats = await sharp(buffer).stats();
    const low = meta.width < 480 || meta.height < 480;
    const bright = stats.channels.reduce((s, c) => s + c.mean, 0) / stats.channels.length;
    const dark = bright < 30, over = bright > 230;
    const shp = stats.channels.reduce((s, c) => s + c.stdev, 0) / stats.channels.length;
    const blur = shp < 15;
    const issues = [];
    if (low) issues.push('Low resolution');
    if (dark) issues.push('Too dark');
    if (over) issues.push('Too bright');
    if (blur) issues.push('Blurry');
    return {
      quality: {
        resolution: { width: meta.width, height: meta.height, isGood: !low },
        lighting: { brightness: bright, isGood: !dark && !over, tooDark: dark, tooBright: over },
        sharpness: { value: shp, isGood: !blur },
        overall: !low && !dark && !over && !blur
      }, issues
    };
  } catch (e) {
    return { quality: { resolution: { isGood: true }, lighting: { isGood: true }, sharpness: { isGood: true }, overall: true }, issues: [] };
  }
}

// ── AI Analysis (with product recommendations) ──
async function analyzeSkin(b64) {
  try {
    const res = await grok.chat.completions.create({
      model: "grok-2-vision-1212",
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
          {
            type: "text", text: `You are an expert dermatologist. Analyze this facial image thoroughly. Respond ONLY with raw JSON (no markdown, no backticks, no extra text).

{
  "skinType": "combination",
  "overallScore": 75,
  "summary": "Detailed 3-4 sentence assessment of the overall skin condition, texture, hydration, and health.",
  "detectedIssues": [{"issue":"Name","severity":"mild","description":"2-3 sentence description.","affected_areas":["area1"]}],
  "zoneAnalysis": {
    "forehead":{"condition":"good","issues":[],"score":7,"detail":"2 sentence observation."},
    "nose":{"condition":"fair","issues":["issue"],"score":6,"detail":"2 sentence observation."},
    "leftCheek":{"condition":"good","issues":[],"score":8,"detail":"2 sentence observation."},
    "rightCheek":{"condition":"good","issues":[],"score":8,"detail":"2 sentence observation."},
    "chin":{"condition":"fair","issues":["issue"],"score":6,"detail":"2 sentence observation."},
    "aroundEyes":{"condition":"concerning","issues":["issue"],"score":5,"detail":"2 sentence observation."},
    "aroundMouth":{"condition":"good","issues":[],"score":7,"detail":"2 sentence observation."}
  },
  "productRecommendations": [
    {"type":"Cleanser","name":"Gentle Foaming Cleanser with Salicylic Acid 0.5%","description":"Mild cleanser for oily/combination skin.","usage":"Twice daily","keyIngredient":"Salicylic Acid"},
    {"type":"Serum","name":"Niacinamide 10% + Zinc 1% Serum","description":"Targets pores and uneven tone.","usage":"Once daily AM","keyIngredient":"Niacinamide 10%"},
    {"type":"Moisturizer","name":"Lightweight Gel Moisturizer with Hyaluronic Acid","description":"Oil-free hydration.","usage":"Twice daily","keyIngredient":"Hyaluronic Acid"},
    {"type":"Sunscreen","name":"Broad Spectrum SPF 50 PA+++","description":"Prevents hyperpigmentation and aging.","usage":"Every morning","keyIngredient":"SPF 50"}
  ],
  "treatmentRecommendations": [{"treatment":"Name","purpose":"Purpose","frequency":"Frequency","notes":"Notes"}],
  "homeCareRoutine": {
    "morning":["Step 1","Step 2","Step 3"],
    "evening":["Step 1","Step 2","Step 3","Step 4"]
  },
  "lifestyleSuggestions": {
    "diet":["Suggestion 1","Suggestion 2"],
    "sleep":["Suggestion 1"],
    "habits":["Suggestion 1","Suggestion 2"]
  },
  "progressTimeline": {
    "week1":"Expected changes in week 1",
    "week4":"Expected changes by week 4",
    "week12":"Expected changes by week 12"
  }
}

IMPORTANT: Tailor productRecommendations to detected conditions. Include 4-6 products with real ingredient types and concentrations.`
          }
        ]
      }],
      temperature: 0.7,
      max_tokens: 4096
    });

    let txt = res.choices[0].message.content.trim();
    txt = txt.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    if (!txt.startsWith('{')) {
      const s = txt.indexOf('{'), e = txt.lastIndexOf('}');
      if (s !== -1 && e !== -1) txt = txt.substring(s, e + 1);
    }
    try { return { success: true, analysis: JSON.parse(txt) }; }
    catch (pe) { return { success: false, error: 'AI response was not valid JSON' }; }
  } catch (e) {
    console.error('[Grok] Error:', e.message);
    return { success: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF REPORT
// ══════════════════════════════════════════════════════════════════════════════

function generatePdfReport(analysis, images, res) {
  const PW = 595.28;
  const PH = 841.89;
  const ML = 36;
  const W  = PW - ML * 2;

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    info: { Title: 'Dermatological Skin Analysis Report', Author: 'DermaAI' }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename="Skin_Report_${new Date().toISOString().split('T')[0]}.pdf"`);
  doc.pipe(res);

  const date = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const rid  = 'DA-' + Date.now().toString(36).toUpperCase();

  const safe = (t) => {
    if (!t) return '';
    return String(t).replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  };

  // Colours
  const NAVY   = '#1a3352';
  const BLUE   = '#2563eb';
  const LBLUE  = '#dbeafe';
  const GREEN  = '#16a34a';
  const LGREEN = '#dcfce7';
  const AMBER  = '#d97706';
  const LAMBER = '#fef3c7';
  const RED    = '#dc2626';
  const LRED   = '#fee2e2';
  const DARK   = '#1f2937';
  const GRAY   = '#6b7280';
  const MGRAY  = '#9ca3af';
  const LGRAY  = '#f3f4f6';
  const WHITE  = '#ffffff';
  const BORDER = '#e5e7eb';
  const PURPLE = '#e0e7ff';
  const PDARK  = '#4338ca';

  const condStyle = (c) => {
    if (c === 'good')  return { bg: LGREEN, fg: GREEN,  lbl: 'GOOD' };
    if (c === 'fair')  return { bg: LAMBER, fg: AMBER,  lbl: 'FAIR' };
    return                    { bg: LRED,   fg: RED,    lbl: 'CONCERNING' };
  };
  const sevStyle = (s) => {
    if (s === 'mild')     return { bg: LGREEN, fg: GREEN };
    if (s === 'moderate') return { bg: LAMBER, fg: AMBER };
    return                       { bg: LRED,   fg: RED };
  };
  const scoreColor = (s) => s >= 70 ? GREEN : s >= 40 ? AMBER : RED;

  // Drawing helpers
  const rr = (x, y, w, h, r, fillCol, strokeCol, lw = 0.5) => {
    doc.save();
    if (fillCol)   doc.fillColor(fillCol);
    if (strokeCol) { doc.strokeColor(strokeCol); doc.lineWidth(lw); }
    doc.roundedRect(x, y, w, h, r);
    if (fillCol && strokeCol) doc.fillAndStroke();
    else if (fillCol)         doc.fill();
    else if (strokeCol)       doc.stroke();
    doc.restore();
  };

  const rectFill = (x, y, w, h, col) => {
    doc.save().fillColor(col).rect(x, y, w, h).fill().restore();
  };

  const drawLine = (x1, y1, x2, y2, col = BORDER, lw = 0.5) => {
    doc.save().strokeColor(col).lineWidth(lw).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
  };

  const dot = (cx, cy, r, col) => {
    doc.save().fillColor(col).circle(cx, cy, r).fill().restore();
  };

  const drawGauge = (cx, cy, r, score, col) => {
    const lw = 10;
    doc.save().strokeColor(LGRAY).lineWidth(lw).circle(cx, cy, r).stroke().restore();
    if (score <= 0) return;
    const startA = -Math.PI / 2;
    const endA   = startA + (Math.min(score, 100) / 100) * 2 * Math.PI;
    const steps  = Math.max(60, Math.round(score * 2));
    doc.save().strokeColor(col).lineWidth(lw).lineCap('round');
    doc.moveTo(cx + r * Math.cos(startA), cy + r * Math.sin(startA));
    for (let i = 1; i <= steps; i++) {
      const a = startA + (i / steps) * (endA - startA);
      doc.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    doc.stroke().restore();
  };

  const textBlock = (txt, x, y, w, font, size, col, lineH = size * 1.45) => {
    const words = safe(txt).split(' ').filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      doc.font(font).fontSize(size);
      if (doc.widthOfString(test) <= w) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    doc.save().font(font).fontSize(size).fillColor(col);
    lines.forEach((ln, i) => doc.text(ln, x, y + i * lineH, { lineBreak: false }));
    doc.restore();
    return lines.length * lineH;
  };

  const sectionHeader = (title, y) => {
    rectFill(ML, y, W, 28, NAVY);
    doc.save().font('Helvetica-Bold').fontSize(9.5).fillColor(WHITE);
    doc.text(safe(title).toUpperCase(), ML + 14, y + 9, { lineBreak: false });
    doc.restore();
    return y + 36;
  };

  let pageCount = 1;

  const footerLine = () => {
    drawLine(ML, PH - 38, PW - ML, PH - 38, BORDER, 0.5);
  };

  const needPage = (h, curY) => {
    if (curY + h > PH - 52) {
      footerLine();
      doc.addPage();
      pageCount++;
      rectFill(0, 0, PW, 4, NAVY);
      return 22;
    }
    return curY;
  };

  // ════════════════════ PAGE 1 ════════════════════

  // Hero
  rectFill(0, 0, PW, 90, NAVY);
  rectFill(0, 90, PW, 4, '#2a4a6a');
  doc.save()
    .font('Helvetica-Bold').fontSize(20).fillColor(WHITE)
    .text('DERMATOLOGICAL ANALYSIS REPORT', ML, 18, { lineBreak: false });
  doc.font('Helvetica').fontSize(9.5).fillColor('#8eaac4')
    .text('AI-Powered Clinical Skin Assessment', ML, 46, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor('#8eaac4')
    .text(`Report Date: ${date}   |   Report ID: ${rid}`, ML, 64, { lineBreak: false });
  doc.restore();

  let y = 104;

  // Patient Photos
  if (images) {
    const entries = [
      { key: 'front', label: 'Front View' },
      { key: 'left',  label: 'Left 45 deg' },
      { key: 'right', label: 'Right 45 deg' }
    ].filter(e => images[e.key]);

    if (entries.length) {
      const imgW = Math.min(148, (W - (entries.length - 1) * 12) / entries.length);
      const imgH = Math.round(imgW * 1.2);
      const totalW = entries.length * imgW + (entries.length - 1) * 12;
      let ix = ML + (W - totalW) / 2;

      for (const entry of entries) {
        try {
          const buf = Buffer.from(images[entry.key].replace(/^data:image\/\w+;base64,/, ''), 'base64');
          doc.save();
          doc.rect(ix + 1, y + 1, imgW - 2, imgH - 2).clip();
          doc.image(buf, ix + 1, y + 1, { width: imgW - 2, height: imgH - 2, cover: [imgW - 2, imgH - 2], align: 'center', valign: 'center' });
          doc.restore();
          rr(ix, y, imgW, imgH, 6, null, BORDER, 1);
        } catch (_) {
          rr(ix, y, imgW, imgH, 6, LGRAY, BORDER, 1);
        }
        doc.save().font('Helvetica').fontSize(7.5).fillColor(GRAY)
          .text(safe(entry.label), ix, y + imgH + 5, { width: imgW, align: 'center', lineBreak: false })
          .restore();
        ix += imgW + 12;
      }
      y += imgH + 22;
    }
  }

  // Score Card
  const sc     = analysis.overallScore || 0;
  const sCol   = scoreColor(sc);
  const sLabel = sc >= 70 ? 'GOOD' : sc >= 40 ? 'FAIR' : 'NEEDS ATTENTION';

  rr(ML, y, W, 148, 8, WHITE, BORDER, 0.8);

  const gaugeR  = 46;
  const gaugeCX = ML + 78;
  const gaugeCY = y + 20 + gaugeR;
  drawGauge(gaugeCX, gaugeCY, gaugeR, sc, sCol);

  doc.save().font('Helvetica-Bold').fontSize(30).fillColor(sCol)
    .text(String(sc), gaugeCX - 22, gaugeCY - 20, { lineBreak: false, width: 44, align: 'center' });
  doc.font('Helvetica').fontSize(8.5).fillColor(MGRAY)
    .text('/ 100', gaugeCX - 18, gaugeCY + 14, { lineBreak: false, width: 36, align: 'center' });
  doc.restore();

  const dx = ML + 145;
  doc.save().font('Helvetica-Bold').fontSize(13).fillColor(DARK)
    .text('Overall Skin Health', dx, y + 12, { lineBreak: false }).restore();

  const svBg = sc >= 70 ? LGREEN : sc >= 40 ? LAMBER : LRED;
  rr(dx, y + 32, 105, 20, 10, svBg, null);
  doc.save().font('Helvetica-Bold').fontSize(9).fillColor(sCol)
    .text(sLabel, dx + 8, y + 37, { lineBreak: false }).restore();

  textBlock(analysis.summary || 'Analysis complete.', dx, y + 60, W - 153, 'Helvetica', 8.5, GRAY, 13);

  rr(dx, y + 124, 140, 18, 9, LBLUE, null);
  const st = safe((analysis.skinType || 'N/A').charAt(0).toUpperCase() + (analysis.skinType || '').slice(1));
  doc.save().font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY)
    .text(`Skin Type: ${st}`, dx + 10, y + 128, { lineBreak: false }).restore();

  y += 156;

  // Detected Conditions
  y = sectionHeader('Detected Conditions', y);

  for (let idx = 0; idx < (analysis.detectedIssues || []).length; idx++) {
    const issue = analysis.detectedIssues[idx];
    const sv = sevStyle(issue.severity);
    y = needPage(82, y);

    rr(ML, y, W, 74, 6, WHITE, BORDER, 0.8);
    rr(ML, y, 5, 74, 3, sv.fg, null);

    doc.save().font('Helvetica-Bold').fontSize(11).fillColor(DARK)
      .text(safe(issue.issue), ML + 14, y + 10, { lineBreak: false }).restore();

    const bw = 76;
    rr(ML + W - bw - 8, y + 8, bw, 18, 9, sv.bg, null);
    doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(sv.fg)
      .text(safe((issue.severity || '').toUpperCase()),
            ML + W - bw - 2, y + 12, { lineBreak: false, width: bw - 4, align: 'center' }).restore();

    textBlock(issue.description || '', ML + 14, y + 30, W - 28, 'Helvetica', 8.5, GRAY, 12);

    if (issue.affected_areas && issue.affected_areas.length) {
      doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(MGRAY)
        .text('Affected: ' + safe(issue.affected_areas.join(', ')),
              ML + 14, y + 56, { lineBreak: false }).restore();
    }
    y += 82;
  }

  // Facial Zone Analysis
  y += 4;
  y = needPage(50, y);
  y = sectionHeader('Facial Zone Analysis', y);

  const zones  = Object.entries(analysis.zoneAnalysis || {});
  const colW   = (W - 10) / 2;

  for (let i = 0; i < zones.length; i += 2) {
    const pair = zones.slice(i, i + 2);
    const rowH = 60;
    y = needPage(rowH + 8, y);

    pair.forEach(([zone, data], j) => {
      const zx = ML + j * (colW + 10);
      const cs = condStyle(data.condition);
      rr(zx, y, colW, rowH, 8, cs.bg, cs.fg, 0.8);
      dot(zx + 16, y + 16, 5, cs.fg);

      const zname = zone.replace(/([A-Z])/g, ' $1').trim();
      doc.save().font('Helvetica-Bold').fontSize(10).fillColor(DARK)
        .text(safe(zname.charAt(0).toUpperCase() + zname.slice(1)), zx + 28, y + 8, { lineBreak: false }).restore();

      doc.save().font('Helvetica-Bold').fontSize(18).fillColor(cs.fg)
        .text(String(data.score || 0), zx + colW - 50, y + 4, { lineBreak: false, width: 28, align: 'right' }).restore();
      doc.save().font('Helvetica').fontSize(8).fillColor(MGRAY)
        .text('/10', zx + colW - 20, y + 14, { lineBreak: false }).restore();

      doc.save().font('Helvetica-Bold').fontSize(7).fillColor(cs.fg)
        .text(cs.lbl, zx + 28, y + 26, { lineBreak: false }).restore();

      const issueList = data.issues && data.issues.length ? data.issues.join(', ') : (data.detail || '');
      if (issueList) {
        doc.save().font('Helvetica').fontSize(7.5).fillColor(GRAY)
          .text(safe(issueList), zx + 14, y + 40, { lineBreak: false, width: colW - 22 }).restore();
      }
    });
    y += rowH + 8;
  }

  footerLine();

  // ════════════════════ PAGE 2 ════════════════════
  doc.addPage();
  pageCount++;
  rectFill(0, 0, PW, 4, NAVY);
  y = 22;

  doc.save().font('Helvetica-Bold').fontSize(13).fillColor(NAVY)
    .text('TREATMENT & CARE PLAN', ML, y + 4, { lineBreak: false }).restore();
  doc.save().font('Helvetica').fontSize(7.5).fillColor(MGRAY)
    .text(`${date}  |  ${rid}`, ML + W - 200, y + 6, { lineBreak: false, width: 200, align: 'right' }).restore();
  drawLine(ML, y + 26, PW - ML, y + 26, NAVY, 1);
  y += 36;

  // ── NEW: Product Recommendations ──
  if (analysis.productRecommendations && analysis.productRecommendations.length > 0) {
    y = sectionHeader('Recommended Products', y);

    for (let idx = 0; idx < analysis.productRecommendations.length; idx++) {
      const p = analysis.productRecommendations[idx];
      y = needPage(68, y);

      rr(ML, y, W, 60, 6, WHITE, BORDER, 0.8);

      // Type badge
      rr(ML + 10, y + 8, 62, 14, 7, LBLUE, null);
      doc.save().font('Helvetica-Bold').fontSize(7).fillColor(NAVY)
        .text(safe((p.type || '').toUpperCase()), ML + 10, y + 10, { lineBreak: false, width: 62, align: 'center' }).restore();

      // Product name
      doc.save().font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
        .text(safe(p.name), ML + 80, y + 8, { lineBreak: false, width: W - 90 }).restore();

      // Description
      textBlock(p.description || '', ML + 14, y + 26, W - 28, 'Helvetica', 8, GRAY, 11);

      // Usage + ingredient badges
      if (p.usage) {
        rr(ML + 14, y + 44, 110, 12, 3, LGREEN, null);
        doc.save().font('Helvetica-Bold').fontSize(6.5).fillColor(GREEN)
          .text(safe(p.usage), ML + 18, y + 46, { lineBreak: false }).restore();
      }
      if (p.keyIngredient) {
        rr(ML + 130, y + 44, 100, 12, 3, LAMBER, null);
        doc.save().font('Helvetica-Bold').fontSize(6.5).fillColor(AMBER)
          .text(safe(p.keyIngredient), ML + 134, y + 46, { lineBreak: false }).restore();
      }

      y += 66;
    }
  }

  // Treatment Recommendations
  y = sectionHeader('Treatment Recommendations', y);

  for (let idx = 0; idx < (analysis.treatmentRecommendations || []).length; idx++) {
    const t = analysis.treatmentRecommendations[idx];
    y = needPage(78, y);
    rr(ML, y, W, 72, 6, WHITE, BORDER, 0.8);

    dot(ML + 18, y + 18, 12, BLUE);
    doc.save().font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
      .text(String(idx + 1), ML + 12, y + 13, { lineBreak: false, width: 12, align: 'center' }).restore();

    doc.save().font('Helvetica-Bold').fontSize(11).fillColor(DARK)
      .text(safe(t.treatment), ML + 36, y + 8, { lineBreak: false }).restore();

    textBlock(t.purpose || '', ML + 36, y + 24, W - 44, 'Helvetica', 8.5, GRAY, 12);

    const fy = y + 48;
    rr(ML + 36, fy, 138, 16, 4, LBLUE, null);
    doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY)
      .text('Frequency: ' + safe(t.frequency), ML + 42, fy + 3, { lineBreak: false }).restore();

    if (t.notes) {
      doc.save().font('Helvetica').fontSize(7.5).fillColor(MGRAY)
        .text(safe(t.notes), ML + 182, fy + 3, { lineBreak: false, width: W - 190 }).restore();
    }
    y += 80;
  }

  // Home Care Routine
  y += 4;
  y = needPage(40, y);
  y = sectionHeader('Daily Home Care Routine', y);

  const half   = (W - 12) / 2;
  const mSteps = (analysis.homeCareRoutine && analysis.homeCareRoutine.morning) || [];
  const eSteps = (analysis.homeCareRoutine && analysis.homeCareRoutine.evening) || [];

  y = needPage(Math.max(mSteps.length, eSteps.length) * 22 + 40, y);

  rr(ML, y, half, 24, 4, LAMBER, null);
  doc.save().font('Helvetica-Bold').fontSize(9).fillColor(AMBER)
    .text('AM   MORNING ROUTINE', ML + 12, y + 7, { lineBreak: false }).restore();

  const eX = ML + half + 12;
  rr(eX, y, half, 24, 4, PURPLE, null);
  doc.save().font('Helvetica-Bold').fontSize(9).fillColor(PDARK)
    .text('PM   EVENING ROUTINE', eX + 12, y + 7, { lineBreak: false }).restore();

  y += 30;

  mSteps.forEach((step, si) => {
    rr(ML + 8, y + si * 22 + 3, 16, 16, 8, LGRAY, null);
    doc.save().font('Helvetica-Bold').fontSize(8).fillColor(GRAY)
      .text(String(si + 1), ML + 8, y + si * 22 + 6, { lineBreak: false, width: 16, align: 'center' }).restore();
    textBlock(safe(step), ML + 30, y + si * 22 + 5, half - 36, 'Helvetica', 8.5, DARK, 12);
  });

  eSteps.forEach((step, si) => {
    rr(eX + 8, y + si * 22 + 3, 16, 16, 8, LGRAY, null);
    doc.save().font('Helvetica-Bold').fontSize(8).fillColor(GRAY)
      .text(String(si + 1), eX + 8, y + si * 22 + 6, { lineBreak: false, width: 16, align: 'center' }).restore();
    textBlock(safe(step), eX + 30, y + si * 22 + 5, half - 36, 'Helvetica', 8.5, DARK, 12);
  });

  y += Math.max(mSteps.length, eSteps.length) * 22 + 14;

  // Lifestyle
  y = needPage(40, y);
  y = sectionHeader('Lifestyle Recommendations', y);

  const catMeta = {
    diet:      { bg: LGREEN, fg: GREEN,  label: 'DIET' },
    sleep:     { bg: LBLUE,  fg: BLUE,   label: 'SLEEP' },
    habits:    { bg: LAMBER, fg: AMBER,  label: 'HABITS' },
    hydration: { bg: LBLUE,  fg: BLUE,   label: 'HYDRATION' },
    exercise:  { bg: LGREEN, fg: GREEN,  label: 'EXERCISE' },
    stress:    { bg: LAMBER, fg: AMBER,  label: 'STRESS' },
  };

  for (const [cat, items] of Object.entries(analysis.lifestyleSuggestions || {})) {
    if (!items || !items.length) continue;
    const meta  = catMeta[cat] || { bg: LGRAY, fg: DARK, label: cat.toUpperCase() };
    const catH  = items.length * 20 + 36;
    y = needPage(catH, y);

    rr(ML, y, W, catH, 6, WHITE, BORDER, 0.8);
    rr(ML + 10, y + 8, 58, 18, 9, meta.bg, null);
    doc.save().font('Helvetica-Bold').fontSize(8).fillColor(meta.fg)
      .text(safe(meta.label), ML + 10, y + 12, { lineBreak: false, width: 58, align: 'center' }).restore();

    items.forEach((item, ki) => {
      const ky = y + 32 + ki * 20;
      doc.save().font('Helvetica-Bold').fontSize(10).fillColor(meta.fg)
        .text('>', ML + 14, ky, { lineBreak: false }).restore();
      textBlock(safe(item), ML + 28, ky + 1, W - 38, 'Helvetica', 8.5, DARK, 12);
    });
    y += catH + 8;
  }

  // Progress Timeline
  y = needPage(40, y);
  y = sectionHeader('Expected Progress Timeline', y);

  const timeline = Object.entries(analysis.progressTimeline || {});
  for (let idx = 0; idx < timeline.length; idx++) {
    const [period, desc] = timeline[idx];
    y = needPage(54, y);

    if (idx < timeline.length - 1) {
      drawLine(ML + 16, y + 20, ML + 16, y + 54, BORDER, 2);
    }

    dot(ML + 16, y + 10, 11, BLUE);
    doc.save().font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
      .text(String(idx + 1), ML + 9, y + 5, { lineBreak: false, width: 14, align: 'center' }).restore();

    const label = period
      .replace(/week(\d+)/i, 'Week $1')
      .replace(/month(\d+)/i, 'Month $1')
      .replace(/([A-Z])/g, ' $1').trim();
    doc.save().font('Helvetica-Bold').fontSize(10.5).fillColor(DARK)
      .text(safe(label.charAt(0).toUpperCase() + label.slice(1)), ML + 34, y + 3, { lineBreak: false }).restore();

    const dh = textBlock(safe(desc), ML + 34, y + 18, W - 42, 'Helvetica', 9, GRAY, 13);
    y += Math.max(dh + 24, 50);
  }

  // Disclaimer
  y = needPage(90, y);
  y += 8;
  drawLine(ML, y, PW - ML, y, BORDER, 0.5);
  y += 8;

  rr(ML, y, W, 72, 6, '#fffbf0', '#f0dcc0', 0.8);
  doc.save().font('Helvetica-Bold').fontSize(8).fillColor(AMBER)
    .text('IMPORTANT DISCLAIMER', ML + 14, y + 9, { lineBreak: false }).restore();
  textBlock(
    'This report was generated by an AI-powered skin analysis system and is intended for ' +
    'informational and educational purposes only. It does not constitute medical advice, ' +
    'diagnosis, or treatment recommendations from a licensed healthcare provider. Results are ' +
    'based on photographic analysis and may not capture all skin conditions. Please consult a ' +
    'board-certified dermatologist for professional evaluation and personalized treatment. ' +
    'Do not delay seeking medical advice based on this report.',
    ML + 14, y + 22, W - 28, 'Helvetica', 7.5, GRAY, 12
  );

  y += 80;
  doc.save().font('Helvetica').fontSize(7).fillColor(MGRAY)
    .text(`Generated by DermaAI  |  ${date}  |  ${rid}  |  Confidential`,
          ML, y, { lineBreak: false, width: W, align: 'center' }).restore();

  footerLine();

  // Page numbers
  const total = pageCount;
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    rectFill(PW - ML - 185, PH - 36, 185, 14, WHITE);
    doc.save().font('Helvetica').fontSize(7).fillColor(MGRAY)
      .text(`Page ${i + 1} of ${total}  |  ${rid}`,
            PW - ML - 183, PH - 32, { lineBreak: false, width: 181, align: 'right' }).restore();
    doc.save().font('Helvetica').fontSize(7).fillColor(MGRAY)
      .text(`DermaAI Clinical Report  |  ${date}`,
            ML, PH - 32, { lineBreak: false }).restore();
  }

  doc.end();
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ status: 'ok', provider: 'Grok' });
});

app.post('/api/check-quality', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image' });
    res.json({ success: true, ...await analyzeImageQuality(req.file.buffer) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image' });
    console.log(`[Analyze] ${req.file.mimetype} ${(req.file.size / 1024).toFixed(1)}KB`);
    const qc     = await analyzeImageQuality(req.file.buffer);
    const b64    = req.file.buffer.toString('base64');
    const result = await analyzeSkin(b64);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    res.json({ success: true, quality: qc.quality, analysis: result.analysis, timestamp: new Date().toISOString() });
  } catch (e) { console.error('[Analyze]', e); res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/generate-report', async (req, res) => {
  try {
    const { analysis, images } = req.body;
    if (!analysis) return res.status(400).json({ success: false, error: 'No analysis data' });
    console.log('[PDF] Generating professional report...');
    generatePdfReport(analysis, images, res);
  } catch (e) {
    console.error('[PDF]', e);
    if (!res.headersSent) res.status(500).json({ success: false, error: e.message });
  }
});

app.use((error, req, res, next) => {
  res.status(500).json({ success: false, error: error.message });
});

app.listen(PORT, () => {
  console.log(`\n  DermaAI Server running at http://localhost:${PORT}\n`);
});

module.exports = app;