// middleware/security.js
const config = require('../config');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ── Frame / Iframe Embedding ──
  // Build CSP frame-ancestors from iframe allowed origins list.
  // Falls back to 'self' only (no embedding) when list is empty.
  const iframeOrigins = config.iframeAllowedOrigins || [];
  if (iframeOrigins.length > 0) {
    // Allow embedding from specific origins (and self)
    const frameAncestors = ["'self'", ...iframeOrigins].join(' ');
    res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
    // Do NOT set X-Frame-Options when using CSP frame-ancestors
    // (X-Frame-Options is superseded by CSP in modern browsers)
  } else {
    // No external embedding allowed
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  }

  // ── Camera Permissions ──
  // Allow camera from self AND all configured iframe origins so it works inside iframes.
  if (iframeOrigins.length > 0) {
    const cameraOrigins = ['self', ...iframeOrigins.map(o => `"${o}"`).join(' ')].join(' ');
    res.setHeader('Permissions-Policy', `camera=(${cameraOrigins}), microphone=()`);
  } else {
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
  }

  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

module.exports = securityHeaders;
