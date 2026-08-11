// ============================================================
// middleware/uploadS3.js — Multer + S3 config for image uploads
// Validates file type (images only) and size (max 5 MB).
// Files uploaded to Railway object storage (S3-compatible).
// ============================================================
const multer = require('multer');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

// Initialize S3 client with Railway bucket credentials
const s3Client = new S3Client({
  region: process.env.BUCKET_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.BUCKET_ACCESS_KEY,
    secretAccessKey: process.env.BUCKET_SECRET_KEY,
  },
  endpoint: process.env.BUCKET_ENDPOINT,
  forcePathStyle: true, // Important for S3-compatible services
});

// Store files in memory before uploading to S3
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED.has(file.mimetype)) return cb(null, true);
  return cb(new Error('Only image files are allowed (jpeg, png, webp, gif, avif)'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 }, // 5 MB per file, max 8 files
});

/**
 * Upload files to S3 and attach their URLs to req.uploadedFiles
 */
async function uploadToS3(files) {
  const uploadedFiles = [];

  for (const file of files) {
    const key = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${file.originalname}`;

    try {
      const command = new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await s3Client.send(command);

      // Build the public-facing URL. The bucket itself is PRIVATE (see
      // routes/image.routes.js), so we must NOT point at the raw bucket
      // endpoint directly — the browser would get a 403 trying to load
      // it. Instead, point at our own /api/images/<key> proxy route,
      // which streams the object through our server. (This used to
      // build `${BUCKET_ENDPOINT}/${BUCKET_NAME}/${key}` — a direct,
      // private-bucket URL that always 403'd in the browser, which is
      // why every image uploaded through the admin panel showed up
      // blank on the storefront.) A relative path also avoids needing
      // to know/configure the public base URL here.
      const url = `/api/images/${key}`;
      uploadedFiles.push({
        filename: key,
        url,
        originalname: file.originalname,
      });
    } catch (error) {
      console.error(`Failed to upload ${file.originalname} to S3:`, error);
      throw new Error(`Failed to upload file ${file.originalname}`);
    }
  }

  return uploadedFiles;
}

/**
 * Error handling wrapper so multer errors flow through our handler.
 * Uploads files to S3 after validation.
 */
function uploadImages(fieldName, maxCount = 1) {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: { message: err.message } });
      }

      // If files were uploaded, push them to S3
      if (req.files && req.files.length > 0) {
        try {
          req.uploadedFiles = await uploadToS3(req.files);
        } catch (uploadErr) {
          return res.status(500).json({ success: false, error: { message: uploadErr.message } });
        }
      }

      return next();
    });
  };
}

module.exports = { upload, uploadImages, uploadToS3, s3Client };

