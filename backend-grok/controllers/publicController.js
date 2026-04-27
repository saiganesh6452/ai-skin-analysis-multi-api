// controllers/publicController.js
const { getDB } = require('../config/database');
const { analyzeImageQuality } = require('../services/imageQuality');
const { analyzeSkin } = require('../services/skinAnalysis');
const { generatePdfReport, generatePdfToBuffer } = require('../services/pdfReport');
const { uploadPdf } = require('../services/s3');
const { sanitizePhone } = require('../utils/sanitize');

async function registerUser(req, res) {
  const phone = sanitizePhone(req.body.phone);
  const db = getDB();

  if (!phone || phone.replace(/\D/g, '').length < 7) {
    return res.status(400).json({ success: false, error: 'A valid phone number is required' });
  }
  if (!db) {
    return res.json({ success: true, user: { phone } });
  }

  try {
    await db.collection('users').findOneAndUpdate(
      { phone },
      { $set: { phone, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() }, $inc: { analysisCount: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`[User] ${phone}`);
    res.json({ success: true, user: { phone } });
  } catch (e) {
    if (e.code === 11000) return res.json({ success: true, user: { phone } });
    throw e;
  }
}

async function checkQuality(req, res) {
  if (!req.file) return res.status(400).json({ success: false, error: 'No image' });
  const result = await analyzeImageQuality(req.file.buffer);
  res.json({ success: true, ...result });
}

async function analyze(req, res) {
  if (!req.file) return res.status(400).json({ success: false, error: 'No image' });

  const phone = sanitizePhone(req.body.phone || '');
  const userInfo = { phone };
  const db = getDB();

  console.log(`[Analyze] ${req.file.mimetype} ${(req.file.size / 1024).toFixed(1)}KB`);

  const qc = await analyzeImageQuality(req.file.buffer);
  const b64 = req.file.buffer.toString('base64');
  const result = await analyzeSkin(b64);

  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error });
  }

  const reportId = 'DA-' + Date.now().toString(36).toUpperCase();

  // Respond to frontend immediately — don't make them wait for PDF
  res.json({
    success: true,
    reportId,
    quality: qc.quality,
    analysis: result.analysis,
    timestamp: new Date().toISOString(),
  });

  // Generate PDF + upload to S3 + save metadata to DB in background
  setImmediate(async () => {
    try {
      // Collect all 3 angle images sent from frontend
      const images = {};
      if (req.body.img_front) images.front = req.body.img_front;
      else images.front = `data:image/jpeg;base64,${b64}`; // fallback to uploaded file
      if (req.body.img_left) images.left = req.body.img_left;
      if (req.body.img_right) images.right = req.body.img_right;

      // Generate full PDF to buffer
      const pdfBuffer = await generatePdfToBuffer(result.analysis, images, userInfo);

      // Upload PDF to S3
      let s3Result = null;
      try {
        s3Result = await uploadPdf(reportId, pdfBuffer);
      } catch (s3Err) {
        console.error('[S3] Upload failed:', s3Err.message);
      }

      // Save metadata to DB (no PDF binary)
      if (db) {
        await db.collection('reports').insertOne({
          reportId,
          phone,
          analysis: result.analysis,
          pdfS3Key: s3Result?.key || null,
          pdfS3Url: s3Result?.url || null,
          pdfSize: pdfBuffer.length,
          overallScore: result.analysis.overallScore,
          skinType: result.analysis.skinType,
          issueCount: (result.analysis.detectedIssues || []).length,
          createdAt: new Date(),
        });
      }

      console.log(`[Auto-PDF] ${reportId} saved (${(pdfBuffer.length / 1024).toFixed(1)}KB) → S3: ${s3Result ? 'yes' : 'no'}`);
    } catch (err) {
      console.error('[Auto-PDF] Failed:', err.message);

      // Fallback: save analysis without PDF
      if (db) {
        try {
          await db.collection('reports').insertOne({
            reportId,
            phone,
            analysis: result.analysis,
            pdfS3Key: null,
            pdfS3Url: null,
            pdfSize: 0,
            overallScore: result.analysis.overallScore,
            skinType: result.analysis.skinType,
            issueCount: (result.analysis.detectedIssues || []).length,
            createdAt: new Date(),
            pdfError: err.message,
          });
          console.log(`[Auto-PDF] ${reportId} saved WITHOUT pdf (fallback)`);
        } catch (dbErr) {
          console.error('[Auto-PDF] DB fallback failed:', dbErr.message);
        }
      }
    }
  });
}

async function generateReport(req, res) {
  const { analysis, images, userInfo, reportId } = req.body;
  if (!analysis) return res.status(400).json({ success: false, error: 'No analysis data' });

  console.log('[PDF] Generating for download...');
  const db = getDB();

  const onBuffer = (pdfBuffer) => {
    // Upload fresh PDF to S3 and update DB metadata
    (async () => {
      try {
        const s3Result = await uploadPdf(reportId, pdfBuffer);
        if (db && reportId) {
          await db.collection('reports').updateOne(
            { reportId },
            {
              $set: {
                pdfS3Key: s3Result?.key || null,
                pdfS3Url: s3Result?.url || null,
                pdfSize: pdfBuffer.length,
                pdfDownloadedAt: new Date(),
              },
            }
          );
        }
      } catch (err) {
        console.error('[PDF] S3 upload/DB update failed:', err.message);
      }
    })();
  };

  generatePdfReport(analysis, images, userInfo, res, onBuffer);
}

module.exports = { registerUser, checkQuality, analyze, generateReport };