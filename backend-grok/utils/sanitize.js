// utils/sanitize.js

function sanitizeString(str, maxLen = 500) {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`;(){}]/g, '')
    .replace(/\$/g, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizeEmail(email) {
  if (!email) return '';
  return String(email).toLowerCase().trim().slice(0, 254);
}

function sanitizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[^0-9+\-() ]/g, '').slice(0, 20);
}

// Safe text for PDF (WinAnsi-safe)
function safePdfText(t) {
  if (!t) return '';
  return String(t)
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Escape special regex characters to prevent ReDoS via $regex
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { sanitizeString, sanitizeEmail, sanitizePhone, safePdfText, escapeRegex };
