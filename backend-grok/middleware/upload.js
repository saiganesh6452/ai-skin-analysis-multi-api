// middleware/upload.js
const multer = require('multer');
const config = require('../config');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
    fieldSize: 10 * 1024 * 1024,  // 10MB per text field (base64 images are large)
    fields: 10,                    // max 10 text fields
  },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

module.exports = upload;