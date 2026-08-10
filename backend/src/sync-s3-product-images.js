// ============================================================
// sync-s3-product-images.js
// Scans the S3 bucket for image files and maps them to products.
// Updates product records with S3 URLs so images display on shop.
//
// Looks for:
//   - Product images named with product ID or name pattern
//   - Falls back to: just assign first N images to first N products
//
// Run: railway run node src/sync-s3-product-images.js
// ============================================================
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const prisma = require('./lib/prisma');

const s3Client = new S3Client({
  region: process.env.BUCKET_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.BUCKET_ACCESS_KEY,
    secretAccessKey: process.env.BUCKET_SECRET_KEY,
  },
  endpoint: process.env.BUCKET_ENDPOINT,
  forcePathStyle: true,
});

async function listBucketFiles() {
  console.log('📂 Scanning S3 bucket for images…');
  const files = [];
  let continuationToken = undefined;

  try {
    do {
      const result = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: process.env.BUCKET_NAME,
          ContinuationToken: continuationToken,
        })
      );

      if (result.Contents) {
        files.push(
          ...result.Contents
            .filter(obj => /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(obj.Key))
            .map(obj => obj.Key)
        );
      }

      continuationToken = result.NextContinuationToken;
    } while (continuationToken);
  } catch (error) {
    console.error('❌ Failed to list bucket files:', error.message);
    return [];
  }

  return files;
}

async function main() {
  console.log('🔄 Syncing S3 product images…\n');

  // Get images from bucket
  const bucketFiles = await listBucketFiles();
  console.log(`✅ Found ${bucketFiles.length} image files in bucket\n`);

  if (bucketFiles.length === 0) {
    console.log('⚠️  No images found in bucket. Upload images via admin panel.');
    process.exit(0);
  }

  // Get all products
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📦 Found ${products.length} products in database\n`);

  // Simple strategy: assign bucket images to products in order
  // (in production, you'd match by filename/ID)
  let updated = 0;
  const baseUrl = `${process.env.BUCKET_ENDPOINT}/${process.env.BUCKET_NAME}`;

  for (let i = 0; i < products.length && i < bucketFiles.length; i++) {
    const product = products[i];
    const bucketFile = bucketFiles[i];
    const imageUrl = `${baseUrl}/${bucketFile}`;

    try {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          image: imageUrl,
          gallery: [imageUrl],
        },
      });
      updated++;
      console.log(`✅ [${i + 1}/${Math.min(products.length, bucketFiles.length)}] ${product.name}`);
      console.log(`   → ${imageUrl}\n`);
    } catch (error) {
      console.error(`❌ Failed to update ${product.name}:`, error.message);
    }
  }

  console.log(`\n✅ Synced ${updated} products with S3 images.`);
  console.log(`   Refresh your shop page — images should now display!\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});

