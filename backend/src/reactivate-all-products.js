// ============================================================
// One-time fix: reactivate every product currently marked
// inactive (isActive: false). Used to undo accidental mass
// "delete" clicks made while testing, before delete filtering
// was fixed. Safe to run more than once.
// Run once with: railway run node src/reactivate-all-products.js
// ============================================================
const prisma = require('./lib/prisma');

async function main() {
  const result = await prisma.product.updateMany({
    where: { isActive: false },
    data: { isActive: true },
  });

  console.log(`✅ Reactivated ${result.count} product(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
