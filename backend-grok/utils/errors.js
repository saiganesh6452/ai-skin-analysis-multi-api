// utils/errors.js
const config = require('../config');

// Never leak internals in production
function safeError(res, statusCode, error, internalMsg) {
  if (internalMsg) console.error(`[Error] ${internalMsg}`);

  let msg;
  if (config.isProduction && statusCode >= 500) {
    msg = 'Something went wrong';
  } else if (typeof error === 'string') {
    msg = error;
  } else {
    msg = error?.message || 'Unknown error';
  }

  return res.status(statusCode).json({ success: false, error: msg });
}

// Async route wrapper — catches thrown errors automatically
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { safeError, asyncHandler };
