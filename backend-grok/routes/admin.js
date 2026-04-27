// routes/admin.js
const express = require('express');
const path = require('path');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { adminLimit, adminLoginLimit } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../utils/errors');
const config = require('../config');
const ctrl = require('../controllers/adminController');

// Serve admin page
router.get('/', (req, res) => {
  if (!config.admin.key && config.isProduction) return res.status(403).send('Admin disabled');
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

// All API routes require auth + rate limiting
// Stats uses loginLimit on first call (acts as login verification)
router.get('/api/stats', adminLoginLimit, adminAuth, asyncHandler(ctrl.getStats));

// Other routes use standard admin limit
router.get('/api/users',                 adminLimit, adminAuth, asyncHandler(ctrl.getUsers));
router.get('/api/reports',               adminLimit, adminAuth, asyncHandler(ctrl.getReports));
router.get('/api/reports/:reportId',     adminLimit, adminAuth, asyncHandler(ctrl.getReportDetail));
router.get('/api/reports/:reportId/pdf', adminLimit, adminAuth, asyncHandler(ctrl.downloadPdf));
router.delete('/api/reports/:reportId',  adminLimit, adminAuth, asyncHandler(ctrl.deleteReport));

module.exports = router;
