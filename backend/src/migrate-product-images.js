// ============================================================
// migrate-product-images.js
// One-time fix: clear out old local image paths (/images/products/*)
// so they don't 404 and hide products on the shop.
//
// New images will be uploaded via the admin panel to S3.
// Run once with: railway run node src/migrate-product-images.js
// ============================================================
const prisma = require('./lib/prisma');

async function main() {
  console.log('🔄 Migrating product images (removing old local paths)…\n');

  const products = await prisma.product.findMany();
  let updated = 0;

  for (const product of products) {
    // Check if image is an old local path (starts with /images/ or images/)
    const isOldLocalPath = 
      (product.image && typeof product.image === 'string' && 
       (product.image.startsWith('/images/') || product.image.startsWith('images/')));

    if (isOldLocalPath) {
      // Clear the old path; admins can re-upload new images via the admin panel
      await prisma.product.update({
        where: { id: product.id },
        data: { 
          image: '', 
          gallery: [] // clear old gallery paths too
        },
      });
      updated++;
      console.log(`✅ Cleared: ${product.name}`);
    }
  }

  console.log(`\n✅ Done. Cleared ${updated} of ${products.length} products.`);
  console.log('   Products without images will not display on the shop.');
  console.log('   Upload new images via the admin panel to make them visible again.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

