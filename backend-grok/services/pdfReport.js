// services/pdfReport.js
const PDFDocument = require('pdfkit');
const { safePdfText } = require('../utils/sanitize');

function generatePdfReport(analysis, images, userInfo, res, onBuffer) {
  const PW = 595.28, PH = 841.89, ML = 36, W = PW - ML * 2;
  const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 }, bufferPages: true, info: { Title: 'Dermatological Skin Analysis Report', Author: 'From Negative' } });

  // Collect buffer for DB storage
  const chunks = [];
  if (onBuffer) {
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => onBuffer(Buffer.concat(chunks)));
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Skin_Report_${new Date().toISOString().split('T')[0]}.pdf"`);
  doc.pipe(res);

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const rid = 'DA-' + Date.now().toString(36).toUpperCase();
  const safe = safePdfText;

  // Colours
  const NAVY = '#1a3352', BLUE = '#2563eb', LBLUE = '#dbeafe', GREEN = '#16a34a', LGREEN = '#dcfce7';
  const AMBER = '#d97706', LAMBER = '#fef3c7', RED = '#dc2626', LRED = '#fee2e2';
  const DARK = '#1f2937', GRAY = '#6b7280', MGRAY = '#9ca3af', LGRAY = '#f3f4f6';
  const WHITE = '#ffffff', BORDER = '#e5e7eb', PURPLE = '#e0e7ff', PDARK = '#4338ca';

  const condStyle = (c) => c === 'good' ? { bg: LGREEN, fg: GREEN, lbl: 'GOOD' } : c === 'fair' ? { bg: LAMBER, fg: AMBER, lbl: 'FAIR' } : { bg: LRED, fg: RED, lbl: 'CONCERNING' };
  const sevStyle = (s) => s === 'mild' ? { bg: LGREEN, fg: GREEN } : s === 'moderate' ? { bg: LAMBER, fg: AMBER } : { bg: LRED, fg: RED };
  const scoreColor = (s) => s >= 70 ? GREEN : s >= 40 ? AMBER : RED;

  // Drawing helpers
  const rr = (x, y, w, h, r, fc, sc, lw = 0.5) => { doc.save(); if (fc) doc.fillColor(fc); if (sc) { doc.strokeColor(sc); doc.lineWidth(lw); } doc.roundedRect(x, y, w, h, r); if (fc && sc) doc.fillAndStroke(); else if (fc) doc.fill(); else if (sc) doc.stroke(); doc.restore(); };
  const rectFill = (x, y, w, h, c) => { doc.save().fillColor(c).rect(x, y, w, h).fill().restore(); };
  const drawLine = (x1, y1, x2, y2, c = BORDER, lw = 0.5) => { doc.save().strokeColor(c).lineWidth(lw).moveTo(x1, y1).lineTo(x2, y2).stroke().restore(); };
  const dot = (cx, cy, r, c) => { doc.save().fillColor(c).circle(cx, cy, r).fill().restore(); };

  const drawGauge = (cx, cy, r, score, col) => {
    doc.save().strokeColor(LGRAY).lineWidth(10).circle(cx, cy, r).stroke().restore();
    if (score <= 0) return;
    const sA = -Math.PI / 2, eA = sA + (Math.min(score, 100) / 100) * 2 * Math.PI;
    const steps = Math.max(60, Math.round(score * 2));
    doc.save().strokeColor(col).lineWidth(10).lineCap('round');
    doc.moveTo(cx + r * Math.cos(sA), cy + r * Math.sin(sA));
    for (let i = 1; i <= steps; i++) { const a = sA + (i / steps) * (eA - sA); doc.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
    doc.stroke().restore();
  };

  const textBlock = (txt, x, y, w, font, size, col, lineH = size * 1.45) => {
    const words = safe(txt).split(' ').filter(Boolean);
    const lines = []; let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      doc.font(font).fontSize(size);
      if (doc.widthOfString(test) <= w) line = test;
      else { if (line) lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    doc.save().font(font).fontSize(size).fillColor(col);
    lines.forEach((ln, i) => doc.text(ln, x, y + i * lineH, { lineBreak: false }));
    doc.restore();
    return lines.length * lineH;
  };

  const sectionHeader = (title, y) => {
    rectFill(ML, y, W, 28, NAVY);
    doc.save().font('Helvetica-Bold').fontSize(9.5).fillColor(WHITE).text(safe(title).toUpperCase(), ML + 14, y + 9, { lineBreak: false }).restore();
    return y + 34;
  };

  let pageCount = 1;
  const footerLine = () => drawLine(ML, PH - 38, PW - ML, PH - 38, BORDER, 0.5);
  const needPage = (h, curY) => {
    if (curY + h > PH - 42) { footerLine(); doc.addPage(); pageCount++; rectFill(0, 0, PW, 4, NAVY); return 20; }
    return curY;
  };

  // ═══ PAGE 1: Header ═══
  rectFill(0, 0, PW, 90, NAVY); rectFill(0, 90, PW, 4, '#2a4a6a');
  doc.save().font('Helvetica-Bold').fontSize(20).fillColor(WHITE).text('DERMATOLOGICAL ANALYSIS REPORT', ML, 18, { lineBreak: false });
  doc.font('Helvetica').fontSize(9.5).fillColor('#8eaac4').text('AI-Powered Clinical Skin Assessment', ML, 46, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor('#8eaac4').text(`Report Date: ${date}   |   Report ID: ${rid}`, ML, 64, { lineBreak: false }); doc.restore();
  let y = 104;

  // Patient info
  if (userInfo && (userInfo.name || userInfo.email || userInfo.phone)) {
    rr(ML, y, W, 44, 6, LGRAY, BORDER, 0.8);
    doc.save().font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY).text('PATIENT INFORMATION', ML + 14, y + 8, { lineBreak: false }).restore();
    const iy = y + 24; let ix = ML + 14;
    if (userInfo.name) { doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(GRAY).text('Name:', ix, iy, { lineBreak: false }).restore(); doc.save().font('Helvetica').fontSize(7.5).fillColor(DARK).text(safe(userInfo.name), ix + 34, iy, { lineBreak: false }).restore(); ix += 160; }
    if (userInfo.email) { doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(GRAY).text('Email:', ix, iy, { lineBreak: false }).restore(); doc.save().font('Helvetica').fontSize(7.5).fillColor(DARK).text(safe(userInfo.email), ix + 34, iy, { lineBreak: false }).restore(); ix += 180; }
    if (userInfo.phone) { doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(GRAY).text('Phone:', ix, iy, { lineBreak: false }).restore(); doc.save().font('Helvetica').fontSize(7.5).fillColor(DARK).text(safe(userInfo.phone), ix + 36, iy, { lineBreak: false }).restore(); }
    y += 50;
  }

  // Photos
  if (images) {
    const entries = [{ key: 'front', label: 'Front View' }, { key: 'left', label: 'Left 45 deg' }, { key: 'right', label: 'Right 45 deg' }].filter(e => images[e.key]);
    if (entries.length) {
      const imgW = Math.min(148, (W - (entries.length - 1) * 12) / entries.length), imgH = Math.round(imgW * 1.2);
      const totalW = entries.length * imgW + (entries.length - 1) * 12;
      let ix = ML + (W - totalW) / 2;
      for (const entry of entries) {
        try { const buf = Buffer.from(images[entry.key].replace(/^data:image\/\w+;base64,/, ''), 'base64'); doc.save(); doc.rect(ix + 1, y + 1, imgW - 2, imgH - 2).clip(); doc.image(buf, ix + 1, y + 1, { width: imgW - 2, height: imgH - 2, cover: [imgW - 2, imgH - 2], align: 'center', valign: 'center' }); doc.restore(); rr(ix, y, imgW, imgH, 6, null, BORDER, 1); }
        catch { rr(ix, y, imgW, imgH, 6, LGRAY, BORDER, 1); }
        doc.save().font('Helvetica').fontSize(7.5).fillColor(GRAY).text(safe(entry.label), ix, y + imgH + 5, { width: imgW, align: 'center', lineBreak: false }).restore();
        ix += imgW + 12;
      }
      y += imgH + 20;
    }
  }

  // Score card
  const sc = analysis.overallScore || 0, sCol = scoreColor(sc), sLabel = sc >= 70 ? 'GOOD' : sc >= 40 ? 'FAIR' : 'NEEDS ATTENTION';
  rr(ML, y, W, 148, 8, WHITE, BORDER, 0.8);
  const gR = 46, gCX = ML + 78, gCY = y + 20 + gR;
  drawGauge(gCX, gCY, gR, sc, sCol);
  doc.save().font('Helvetica-Bold').fontSize(30).fillColor(sCol).text(String(sc), gCX - 22, gCY - 20, { lineBreak: false, width: 44, align: 'center' });
  doc.font('Helvetica').fontSize(8.5).fillColor(MGRAY).text('/ 100', gCX - 18, gCY + 14, { lineBreak: false, width: 36, align: 'center' }); doc.restore();
  const dx = ML + 145;
  doc.save().font('Helvetica-Bold').fontSize(13).fillColor(DARK).text('Overall Skin Health', dx, y + 12, { lineBreak: false }).restore();
  rr(dx, y + 32, 105, 20, 10, sc >= 70 ? LGREEN : sc >= 40 ? LAMBER : LRED, null);
  doc.save().font('Helvetica-Bold').fontSize(9).fillColor(sCol).text(sLabel, dx + 8, y + 37, { lineBreak: false }).restore();
  textBlock(analysis.summary || 'Analysis complete.', dx, y + 60, W - 153, 'Helvetica', 8.5, GRAY, 13);
  rr(dx, y + 124, 140, 18, 9, LBLUE, null);
  const st = safe((analysis.skinType || 'N/A').charAt(0).toUpperCase() + (analysis.skinType || '').slice(1));
  doc.save().font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY).text(`Skin Type: ${st}`, dx + 10, y + 128, { lineBreak: false }).restore();
  y += 154;

  // Detected Conditions
  y = sectionHeader('Detected Conditions', y);
  for (const issue of (analysis.detectedIssues || [])) {
    const sv = sevStyle(issue.severity); y = needPage(76, y);
    rr(ML, y, W, 70, 6, WHITE, BORDER, 0.8); rr(ML, y, 5, 70, 3, sv.fg, null);
    doc.save().font('Helvetica-Bold').fontSize(11).fillColor(DARK).text(safe(issue.issue), ML + 14, y + 10, { lineBreak: false }).restore();
    rr(ML + W - 84, y + 8, 76, 18, 9, sv.bg, null);
    doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(sv.fg).text(safe((issue.severity || '').toUpperCase()), ML + W - 82, y + 12, { lineBreak: false, width: 72, align: 'center' }).restore();
    textBlock(issue.description || '', ML + 14, y + 30, W - 28, 'Helvetica', 8.5, GRAY, 12);
    if (issue.affected_areas?.length) doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(MGRAY).text('Affected: ' + safe(issue.affected_areas.join(', ')), ML + 14, y + 54, { lineBreak: false }).restore();
    y += 76;
  }

  // Zones
  y = needPage(50, y); y = sectionHeader('Facial Zone Analysis', y);
  const zones = Object.entries(analysis.zoneAnalysis || {}), colW = (W - 10) / 2;
  for (let i = 0; i < zones.length; i += 2) {
    const pair = zones.slice(i, i + 2); y = needPage(64, y);
    pair.forEach(([zone, data], j) => {
      const zx = ML + j * (colW + 10), cs = condStyle(data.condition);
      rr(zx, y, colW, 58, 8, cs.bg, cs.fg, 0.8); dot(zx + 16, y + 16, 5, cs.fg);
      const zn = zone.replace(/([A-Z])/g, ' $1').trim();
      doc.save().font('Helvetica-Bold').fontSize(10).fillColor(DARK).text(safe(zn.charAt(0).toUpperCase() + zn.slice(1)), zx + 28, y + 8, { lineBreak: false }).restore();
      doc.save().font('Helvetica-Bold').fontSize(18).fillColor(cs.fg).text(String(data.score || 0), zx + colW - 50, y + 4, { lineBreak: false, width: 28, align: 'right' }).restore();
      doc.save().font('Helvetica').fontSize(8).fillColor(MGRAY).text('/10', zx + colW - 20, y + 14, { lineBreak: false }).restore();
      doc.save().font('Helvetica-Bold').fontSize(7).fillColor(cs.fg).text(cs.lbl, zx + 28, y + 26, { lineBreak: false }).restore();
      const il = data.issues?.length ? data.issues.join(', ') : (data.detail || '');
      if (il) doc.save().font('Helvetica').fontSize(7.5).fillColor(GRAY).text(safe(il), zx + 14, y + 40, { lineBreak: false, width: colW - 22 }).restore();
    });
    y += 64;
  }

  // Products
  if (analysis.productRecommendations?.length) {
    y = needPage(96, y); y = sectionHeader('Recommended Products', y);
    for (const p of analysis.productRecommendations) {
      y = needPage(62, y); rr(ML, y, W, 56, 6, WHITE, BORDER, 0.8);
      rr(ML + 10, y + 8, 62, 14, 7, LBLUE, null);
      doc.save().font('Helvetica-Bold').fontSize(7).fillColor(NAVY).text(safe((p.type || '').toUpperCase()), ML + 10, y + 10, { lineBreak: false, width: 62, align: 'center' }).restore();
      doc.save().font('Helvetica-Bold').fontSize(9.5).fillColor(DARK).text(safe(p.name), ML + 80, y + 8, { lineBreak: false, width: W - 90 }).restore();
      if (p.brand) { doc.save().font('Helvetica').fontSize(7).fillColor(NAVY).text(safe(p.brand), ML + 80, y + 20, { lineBreak: false }).restore(); }
      textBlock(p.description || '', ML + 14, p.brand ? y + 32 : y + 26, W - 28, 'Helvetica', 8, GRAY, 11);
      if (p.usage) { rr(ML + 14, y + 40, 110, 12, 3, LGREEN, null); doc.save().font('Helvetica-Bold').fontSize(6.5).fillColor(GREEN).text(safe(p.usage), ML + 18, y + 42, { lineBreak: false }).restore(); }
      if (p.keyIngredient) { rr(ML + 130, y + 40, 100, 12, 3, LAMBER, null); doc.save().font('Helvetica-Bold').fontSize(6.5).fillColor(AMBER).text(safe(p.keyIngredient), ML + 134, y + 42, { lineBreak: false }).restore(); }
      y += 62;
    }
  }

  // Treatments
  y = needPage(108, y); y = sectionHeader('Treatment Recommendations', y);
  (analysis.treatmentRecommendations || []).forEach((t, i) => {
    y = needPage(74, y); rr(ML, y, W, 68, 6, WHITE, BORDER, 0.8);
    dot(ML + 18, y + 18, 12, BLUE);
    doc.save().font('Helvetica-Bold').fontSize(9).fillColor(WHITE).text(String(i + 1), ML + 12, y + 13, { lineBreak: false, width: 12, align: 'center' }).restore();
    doc.save().font('Helvetica-Bold').fontSize(11).fillColor(DARK).text(safe(t.treatment), ML + 36, y + 8, { lineBreak: false }).restore();
    textBlock(t.purpose || '', ML + 36, y + 24, W - 44, 'Helvetica', 8.5, GRAY, 12);
    rr(ML + 36, y + 46, 138, 16, 4, LBLUE, null);
    doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY).text('Frequency: ' + safe(t.frequency), ML + 42, y + 49, { lineBreak: false }).restore();
    if (t.notes) doc.save().font('Helvetica').fontSize(7.5).fillColor(MGRAY).text(safe(t.notes), ML + 182, y + 49, { lineBreak: false, width: W - 190 }).restore();
    y += 74;
  });

  // Home Care Routine
  y = needPage(40, y); y = sectionHeader('Daily Home Care Routine', y);
  const half = (W - 12) / 2, mS = analysis.homeCareRoutine?.morning || [], eS = analysis.homeCareRoutine?.evening || [];
  y = needPage(Math.max(mS.length, eS.length) * 20 + 36, y);
  rr(ML, y, half, 24, 4, LAMBER, null); doc.save().font('Helvetica-Bold').fontSize(9).fillColor(AMBER).text('AM   MORNING ROUTINE', ML + 12, y + 7, { lineBreak: false }).restore();
  const eX = ML + half + 12;
  rr(eX, y, half, 24, 4, PURPLE, null); doc.save().font('Helvetica-Bold').fontSize(9).fillColor(PDARK).text('PM   EVENING ROUTINE', eX + 12, y + 7, { lineBreak: false }).restore();
  y += 28;
  mS.forEach((s, i) => { rr(ML + 8, y + i * 20 + 2, 16, 16, 8, LGRAY, null); doc.save().font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text(String(i + 1), ML + 8, y + i * 20 + 5, { lineBreak: false, width: 16, align: 'center' }).restore(); textBlock(safe(s), ML + 30, y + i * 20 + 4, half - 36, 'Helvetica', 8.5, DARK, 12); });
  eS.forEach((s, i) => { rr(eX + 8, y + i * 20 + 2, 16, 16, 8, LGRAY, null); doc.save().font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text(String(i + 1), eX + 8, y + i * 20 + 5, { lineBreak: false, width: 16, align: 'center' }).restore(); textBlock(safe(s), eX + 30, y + i * 20 + 4, half - 36, 'Helvetica', 8.5, DARK, 12); });
  y += Math.max(mS.length, eS.length) * 20 + 10;

  // Lifestyle
  y = needPage(36, y); y = sectionHeader('Lifestyle Recommendations', y);
  const cm = { diet: { bg: LGREEN, fg: GREEN, label: 'DIET' }, sleep: { bg: LBLUE, fg: BLUE, label: 'SLEEP' }, habits: { bg: LAMBER, fg: AMBER, label: 'HABITS' }, hydration: { bg: LBLUE, fg: BLUE, label: 'HYDRATION' }, exercise: { bg: LGREEN, fg: GREEN, label: 'EXERCISE' }, stress: { bg: LAMBER, fg: AMBER, label: 'STRESS' } };
  for (const [cat, items] of Object.entries(analysis.lifestyleSuggestions || {})) {
    if (!items?.length) continue;
    const m = cm[cat] || { bg: LGRAY, fg: DARK, label: cat.toUpperCase() }, cH = items.length * 18 + 34;
    y = needPage(cH, y); rr(ML, y, W, cH, 6, WHITE, BORDER, 0.8);
    rr(ML + 10, y + 8, 58, 18, 9, m.bg, null); doc.save().font('Helvetica-Bold').fontSize(8).fillColor(m.fg).text(safe(m.label), ML + 10, y + 12, { lineBreak: false, width: 58, align: 'center' }).restore();
    items.forEach((item, ki) => { const ky = y + 30 + ki * 18; doc.save().font('Helvetica-Bold').fontSize(10).fillColor(m.fg).text('>', ML + 14, ky, { lineBreak: false }).restore(); textBlock(safe(item), ML + 28, ky + 1, W - 38, 'Helvetica', 8.5, DARK, 12); });
    y += cH + 6;
  }

  // Timeline
  y = needPage(36, y); y = sectionHeader('Expected Progress Timeline', y);
  const tl = Object.entries(analysis.progressTimeline || {});
  tl.forEach(([p, d], i) => {
    y = needPage(48, y);
    if (i < tl.length - 1) drawLine(ML + 16, y + 20, ML + 16, y + 48, BORDER, 2);
    dot(ML + 16, y + 10, 11, BLUE);
    doc.save().font('Helvetica-Bold').fontSize(9).fillColor(WHITE).text(String(i + 1), ML + 9, y + 5, { lineBreak: false, width: 14, align: 'center' }).restore();
    const lb = p.replace(/week(\d+)/i, 'Week $1').replace(/month(\d+)/i, 'Month $1').replace(/([A-Z])/g, ' $1').trim();
    doc.save().font('Helvetica-Bold').fontSize(10.5).fillColor(DARK).text(safe(lb.charAt(0).toUpperCase() + lb.slice(1)), ML + 34, y + 3, { lineBreak: false }).restore();
    const dh = textBlock(safe(d), ML + 34, y + 18, W - 42, 'Helvetica', 9, GRAY, 13);
    y += Math.max(dh + 22, 44);
  });

  // Disclaimer
  y = needPage(80, y); y += 4;
  drawLine(ML, y, PW - ML, y, BORDER, 0.5); y += 6;
  rr(ML, y, W, 68, 6, '#fffbf0', '#f0dcc0', 0.8);
  doc.save().font('Helvetica-Bold').fontSize(8).fillColor(AMBER).text('IMPORTANT DISCLAIMER', ML + 14, y + 9, { lineBreak: false }).restore();
  textBlock('This report was generated by an AI-powered skin analysis system and is intended for informational and educational purposes only. It does not constitute medical advice, diagnosis, or treatment recommendations from a licensed healthcare provider. Results are based on photographic analysis and may not capture all skin conditions. Please consult a board-certified dermatologist for professional evaluation and personalized treatment. Do not delay seeking medical advice based on this report.', ML + 14, y + 22, W - 28, 'Helvetica', 7.5, GRAY, 11);
  y += 74;
  doc.save().font('Helvetica').fontSize(7).fillColor(MGRAY).text(`Generated by From Negative  |  ${date}  |  ${rid}  |  Confidential`, ML, y, { lineBreak: false, width: W, align: 'center' }).restore();
  footerLine();

  // Page numbers
  const total = pageCount, rng = doc.bufferedPageRange();
  for (let i = 0; i < rng.count; i++) {
    doc.switchToPage(i);
    rectFill(PW - ML - 185, PH - 36, 185, 14, WHITE);
    doc.save().font('Helvetica').fontSize(7).fillColor(MGRAY).text(`Page ${i + 1} of ${total}  |  ${rid}`, PW - ML - 183, PH - 32, { lineBreak: false, width: 181, align: 'right' }).restore();
    doc.save().font('Helvetica').fontSize(7).fillColor(MGRAY).text(`From Negative Clinical Report  |  ${date}`, ML, PH - 32, { lineBreak: false }).restore();
  }

  doc.end();
}

// Generate PDF into a Buffer (for auto-save, no HTTP response needed)
function generatePdfToBuffer(analysis, images, userInfo) {
  return new Promise((resolve, reject) => {
    const { PassThrough } = require('stream');
    const sink = new PassThrough();

    // Discard piped data — we collect via onBuffer callback
    sink.on('data', () => {});
    sink.resume();

    // Fake response that acts like Express res but pipes to our sink
    const fakeRes = Object.assign(sink, {
      setHeader: () => {},
    });

    let resolved = false;

    const onBuffer = (buffer) => {
      if (!resolved) {
        resolved = true;
        resolve(buffer);
      }
    };

    try {
      generatePdfReport(analysis, images, userInfo, fakeRes, onBuffer);
    } catch (err) {
      if (!resolved) { resolved = true; reject(err); }
    }

    // Timeout after 30s
    setTimeout(() => {
      if (!resolved) { resolved = true; reject(new Error('PDF generation timed out')); }
    }, 30000);
  });
}

module.exports = { generatePdfReport, generatePdfToBuffer };