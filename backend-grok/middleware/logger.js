// middleware/logger.js
const crypto = require('crypto');

function requestLogger(req, res, next) {
  const start = Date.now();
  req.requestId = crypto.randomBytes(6).toString('hex');

  // Skip logging for static files
  if (req.path.match(/\.(js|css|png|jpg|ico|svg|woff|woff2|ttf|map)$/)) {
    return next();
  }

  const origEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';

    console.log(
      `${color}${status}${reset} ${req.method} ${req.path} ${duration}ms [${req.requestId}] ${req.ip}`
    );

    origEnd.apply(res, args);
  };

  next();
}

module.exports = requestLogger;
