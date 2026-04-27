// controllers/adminController.js
const { getDB } = require('../config/database');
const { sanitizeString, escapeRegex } = require('../utils/sanitize');

async function getStats(req, res) {
  const db = getDB();
  if (!db) return res.status(503).json({ success: false, error: 'DB offline' });

  const [totalUsers, totalReports, recentReports] = await Promise.all([
    db.collection('users').countDocuments(),
    db.collection('reports').countDocuments(),
    db.collection('reports').find({}, { projection: { pdf: 0, analysis: 0 } })
      .sort({ createdAt: -1 }).limit(5).toArray(),
  ]);

  const avgResult = await db.collection('reports').aggregate([
    { $group: { _id: null, avg: { $avg: '$overallScore' } } },
  ]).toArray();

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalReports,
      avgScore: avgResult[0]?.avg ? Math.round(avgResult[0].avg) : 0,
      recentReports,
    },
  });
}

async function getUsers(req, res) {
  const db = getDB();
  if (!db) return res.status(503).json({ success: false, error: 'DB offline' });

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const search = sanitizeString(req.query.search || '', 100);

  const query = search
    ? { $or: [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { email: { $regex: escapeRegex(search), $options: 'i' } },
        { phone: { $regex: escapeRegex(search), $options: 'i' } },
      ]}
    : {};

  const [users, total] = await Promise.all([
    db.collection('users').find(query).sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).toArray(),
    db.collection('users').countDocuments(query),
  ]);

  res.json({ success: true, users, total, page, pages: Math.ceil(total / limit) });
}

async function getReports(req, res) {
  const db = getDB();
  if (!db) return res.status(503).json({ success: false, error: 'DB offline' });

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const search = sanitizeString(req.query.search || '', 100);

  const query = search
    ? { $or: [
        { email: { $regex: escapeRegex(search), $options: 'i' } },
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { reportId: { $regex: escapeRegex(search), $options: 'i' } },
      ]}
    : {};

  const [reports, total] = await Promise.all([
    db.collection('reports').find(query, { projection: { pdf: 0, analysis: 0 } })
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    db.collection('reports').countDocuments(query),
  ]);

  res.json({ success: true, reports, total, page, pages: Math.ceil(total / limit) });
}

async function getReportDetail(req, res) {
  const db = getDB();
  if (!db) return res.status(503).json({ success: false, error: 'DB offline' });

  const reportId = sanitizeString(req.params.reportId, 50);
  const report = await db.collection('reports').findOne(
    { reportId },
    { projection: { pdf: 0 } }
  );
  if (!report) return res.status(404).json({ success: false, error: 'Not found' });

  res.json({ success: true, report });
}

async function downloadPdf(req, res) {
  const db = getDB();
  if (!db) return res.status(503).json({ success: false, error: 'DB offline' });

  const reportId = sanitizeString(req.params.reportId, 50);
  const report = await db.collection('reports').findOne({ reportId });
  if (!report || !report.pdf) {
    return res.status(404).json({ success: false, error: 'PDF not found' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Skin_Report_${report.reportId}.pdf"`);
  res.send(report.pdf.buffer || report.pdf);
}

async function deleteReport(req, res) {
  const db = getDB();
  if (!db) return res.status(503).json({ success: false, error: 'DB offline' });

  const reportId = sanitizeString(req.params.reportId, 50);
  const result = await db.collection('reports').deleteOne({ reportId });
  if (result.deletedCount === 0) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  console.log(`[Admin] Deleted: ${reportId}`);
  res.json({ success: true });
}

module.exports = { getStats, getUsers, getReports, getReportDetail, downloadPdf, deleteReport };
