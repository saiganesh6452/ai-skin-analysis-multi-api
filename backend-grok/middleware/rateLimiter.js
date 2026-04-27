// middleware/rateLimiter.js
const config = require('../config');

const store = new Map();

setInterval(() => {
  const cutoff = Date.now() - 600000;
  for (const [key, hits] of store) {
    const valid = hits.filter(t => t > cutoff);
    if (!valid.length) store.delete(key);
    else store.set(key, valid);
  }
}, 300000);

function createLimiter(windowMs, maxReqs, keyPrefix = '') {
  return (req, res, next) => {
    const key = keyPrefix + req.ip;
    const now = Date.now();
    if (!store.has(key)) store.set(key, []);
    const hits = store.get(key).filter(t => t > now - windowMs);
    hits.push(now);
    store.set(key, hits);

    res.setHeader('X-RateLimit-Limit', maxReqs);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxReqs - hits.length));

    if (hits.length > maxReqs) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
      });
    }
    next();
  };
}

module.exports = {
  generalLimit:    createLimiter(config.rateLimit.general.windowMs,  config.rateLimit.general.max, 'gen:'),
  analyzeLimit:    createLimiter(config.rateLimit.analyze.windowMs,  config.rateLimit.analyze.max, 'ana:'),
  registerLimit:   createLimiter(config.rateLimit.register.windowMs, config.rateLimit.register.max, 'reg:'),
  reportLimit:     createLimiter(config.rateLimit.report.windowMs,   config.rateLimit.report.max, 'rpt:'),
  adminLimit:      createLimiter(config.rateLimit.admin.windowMs,    config.rateLimit.admin.max, 'adm:'),
  adminLoginLimit: createLimiter(900000, 5, 'adm-login:'), // 5 attempts per 15 min
};
