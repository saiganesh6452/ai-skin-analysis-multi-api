// middleware/adminAuth.js
const crypto = require('crypto');
const config = require('../config');

function adminAuth(req, res, next) {
  if (!config.admin.key) {
    return res.status(403).json({
      success: false,
      error: 'Admin panel disabled. Set ADMIN_KEY in .env',
    });
  }

  const key = req.headers['x-admin-key'] || req.query.key;
  if (!key) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  // Timing-safe comparison to prevent timing attacks
  const keyBuffer = Buffer.from(String(key));
  const adminBuffer = Buffer.from(config.admin.key);

  if (keyBuffer.length !== adminBuffer.length || !crypto.timingSafeEqual(keyBuffer, adminBuffer)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
}

module.exports = adminAuth;
