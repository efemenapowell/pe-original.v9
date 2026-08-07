// ============================================================
// One-time fix: prepend a leading "/" to any product image/gallery
// paths that are missing one (they were seeded as "images/..."
// instead of "/images/..." which broke on the /admin/ page).
// Safe to run more than once — already-correct paths are skipped.
// Run once with: railway run node src/fix-image-paths.js
// ============================================================
const prisma = require('./lib/prisma');

function fix(p) {
  if (!p) return p;
  // Leave absolute paths (/...), uploaded files (/uploads/...),
  // and full URLs (http...) alone — only fix bare relative paths.
  if (p.startsWith('/') || p.startsWith('http')) return p;
  return '/' + p;
}

async function main() {
  const products = await prisma.product.findMany();
  let updated = 0;

  for (const product of products) {
    const newImage = fix(product.image);
    const newGallery = Array.isArray(product.gallery) ? product.gallery.map(fix) : product.gallery;

    const imageChanged = newImage !== product.image;
    const galleryChanged = JSON.stringify(newGallery) !== JSON.stringify(product.gallery);

    if (imageChanged || galleryChanged) {
      await prisma.product.update({
        where: { id: product.id },
        data: { image: newImage, gallery: newGallery },
      });
      updated++;
      console.log(`Fixed: ${product.name}`);
    }
  }

  console.log(`\n✅ Done. ${updated} of ${products.length} products fixed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
