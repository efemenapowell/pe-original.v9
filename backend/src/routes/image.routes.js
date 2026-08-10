// ============================================================
// image.routes.js
// Streams objects from the private S3/Tigris bucket through our
// own server, so the bucket itself never needs to be public.
// ============================================================
const express = require('express');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const router = express.Router();

const s3Client = new S3Client({
  region: process.env.BUCKET_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.BUCKET_ACCESS_KEY,
    secretAccessKey: process.env.BUCKET_SECRET_KEY,
  },
  endpoint: process.env.BUCKET_ENDPOINT,
  forcePathStyle: true,
});

// GET /api/images/<key>  (key may contain slashes)
router.get('/*', async (req, res) => {
  const key = req.params[0];
  if (!key) return res.status(400).json({ error: 'Missing image key' });

  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key,
      })
    );

    res.setHeader('Content-Type', result.ContentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7 days
    result.Body.pipe(res);
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return res.status(404).json({ error: 'Image not found' });
    }
    console.error('[images] Failed to fetch object:', error);
    res.status(502).json({ error: 'Failed to fetch image' });
  }
});

module.exports = router;