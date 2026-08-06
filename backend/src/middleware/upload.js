// ============================================================
// middleware/upload.js — Multer config for image uploads
// Validates file type (images only) and size (max 5 MB).
// Files land in /uploads with a unique name.
// ============================================================
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const config = require('../config');

// Ensure the upload dir exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, config.uploadDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const safe = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext || '.jpg'}`;
    cb(null, safe);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED.has(file.mimetype)) return cb(null, true);
  return cb(new Error('Only image files are allowed (jpeg, png, webp, gif, avif)'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 }, // 5 MB per file, max 8 files/request
});

/** Error handling wrapper so multer errors flow through our handler. */
function uploadImages(fieldName, maxCount = 1) {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: { message: err.message } });
      }
      return next();
    });
  };
}

module.exports = { upload, uploadImages };
