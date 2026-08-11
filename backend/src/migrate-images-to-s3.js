// ============================================================
// migrate-images-to-s3.js
//
// WHY THIS EXISTS
// ----------------
// Before uploadS3.js, admin-uploaded images went to local disk
// (middleware/upload.js, now unused) under /uploads/<timestamp>-
// <hash>.<ext> — the ORIGINAL filename was discarded. Railway's
// filesystem is ephemeral, so those files are already gone after
// every redeploy; they were never really recoverable.
//
// After the S3 migration, new uploads save the ORIGINAL filename
// into the S3 key: <timestamp>-<hash>-<originalname>. So there is
// no reliable way to automatically map an old broken /uploads/...
// path to a specific S3 object — the information needed to do that
// safely does not exist. Guessing would risk assigning the wrong
// photo to the wrong product.
//
// WHAT THIS SCRIPT DOES INSTEAD
// ------------------------------
// 1. AUDIT (always runs): scans Product, Category, and ContentBlock
//    records for any image value that is NOT already a full URL and
//    NOT a bundled frontend asset (/images/...), i.e. anything still
//    pointing at the dead local /uploads/ path. Prints a clear report.
//
// 2. BEST-EFFORT SUGGEST: lists every object currently in the S3
//    bucket and, for each broken record, checks whether the
//    product/category name (slugified) appears in any S3 key. If —
//    and only if — there is EXACTLY ONE confident match, it's shown
//    as a suggestion. Nothing is written unless you pass --apply,
//    and even then only unambiguous single-match suggestions are
//    applied; everything else is left for manual review.
//
// USAGE
// -----
//   railway run node src/migrate-images-to-s3.js              # dry run (report only)
//   railway run node src/migrate-images-to-s3.js --apply       # apply confident matches
//
// After running, anything still listed as "NO CONFIDENT MATCH"
// needs a human: open that product in /admin, re-upload its photo
// there (it will now correctly save as an S3 URL), and save.
// ============================================================
const prisma = require('./lib/prisma');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const APPLY = process.argv.includes('--apply');

const s3Client = new S3Client({
  region: process.env.BUCKET_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.BUCKET_ACCESS_KEY,
    secretAccessKey: process.env.BUCKET_SECRET_KEY,
  },
  endpoint: process.env.BUCKET_ENDPOINT,
  forcePathStyle: true,
});

function isBroken(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return false; // already S3 (or external)
  if (value.startsWith('/images/')) return false; // bundled frontend asset, not a user upload
  return true; // e.g. "/uploads/...", "uploads/...", or any other bare local path
}

function slugTokens(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 3); // ignore tiny/noise tokens
}

async function listAllBucketKeys() {
  const bucket = process.env.BUCKET_NAME;
  if (!bucket) {
    console.error('❌ BUCKET_NAME is not set — cannot list bucket contents. Set BUCKET_* env vars first.');
    return [];
  }
  const keys = [];
  let ContinuationToken;
  do {
    const res = await s3Client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken })
    );
    for (const obj of res.Contents || []) keys.push(obj.Key);
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

function buildUrl(key) {
  // Same fix as middleware/uploadS3.js: the bucket is private, so the
  // public URL must go through our /api/images/<key> proxy route, not
  // point at the bucket directly.
  return `/api/images/${key}`;
}

/** Given a record name + a broken value, find S3 keys whose filename portion
 *  contains every token from the record's name. Returns matching keys. */
function findCandidates(name, bucketKeys) {
  const tokens = slugTokens(name);
  if (!tokens.length) return [];
  return bucketKeys.filter((key) => {
    const lower = key.toLowerCase();
    return tokens.every((t) => lower.includes(t));
  });
}

async function auditAndFix(label, records, getFields) {
  console.log(`\n── ${label} ──────────────────────────────`);
  const bucketKeys = await listAllBucketKeys();
  let brokenCount = 0;
  let appliedCount = 0;

  for (const record of records) {
    const { name, image, gallery, updateData } = getFields(record);
    const brokenImage = isBroken(image);
    const brokenGallery = Array.isArray(gallery) ? gallery.filter(isBroken) : [];

    if (!brokenImage && brokenGallery.length === 0) continue;
    brokenCount++;

    console.log(`\n⚠️  ${label.slice(0, -1)} "${name}" (id: ${record.id})`);
    if (brokenImage) console.log(`   image:   ${image}`);
    brokenGallery.forEach((g) => console.log(`   gallery: ${g}`));

    const candidates = findCandidates(name, bucketKeys);
    if (candidates.length === 1) {
      const newUrl = buildUrl(candidates[0]);
      console.log(`   ✅ single confident match → ${newUrl}`);
      if (APPLY) {
        const data = {};
        if (brokenImage) data.image = newUrl;
        if (brokenGallery.length && Array.isArray(gallery)) {
          data.gallery = gallery.map((g) => (isBroken(g) ? newUrl : g));
        }
        await updateData(data);
        appliedCount++;
        console.log('   → applied');
      }
    } else if (candidates.length > 1) {
      console.log(`   ❓ ${candidates.length} possible matches, too ambiguous to auto-fix:`);
      candidates.forEach((c) => console.log(`      - ${buildUrl(c)}`));
    } else {
      console.log('   ❌ NO CONFIDENT MATCH — needs manual re-upload via /admin');
    }
  }

  if (brokenCount === 0) {
    console.log('   ✅ nothing broken found.');
  } else {
    console.log(
      `\n   ${brokenCount} ${label.toLowerCase()} with broken paths, ${appliedCount} ${
        APPLY ? 'fixed' : 'would be fixed (dry run — pass --apply to write)'
      }.`
    );
  }
}

async function main() {
  if (!process.env.BUCKET_ENDPOINT || !process.env.BUCKET_NAME) {
    console.error('❌ BUCKET_ENDPOINT / BUCKET_NAME env vars are missing in this shell.');
    console.error('   Run this via `railway run node src/migrate-images-to-s3.js` so Railway injects them.');
    process.exit(1);
  }

  console.log(APPLY ? '🔧 Running in APPLY mode — confident matches will be written.' : '🔍 Dry run — no changes will be written (pass --apply to write).');

  const products = await prisma.product.findMany();
  await auditAndFix('Products', products, (p) => ({
    name: p.name,
    image: p.image,
    gallery: p.gallery,
    updateData: (data) => prisma.product.update({ where: { id: p.id }, data }),
  }));

  const categories = await prisma.category.findMany();
  await auditAndFix('Categories', categories, (c) => ({
    name: c.name,
    image: c.image,
    gallery: undefined,
    updateData: (data) => prisma.category.update({ where: { id: c.id }, data }),
  }));

  const content = await prisma.contentBlock.findMany({ where: { type: 'image' } });
  await auditAndFix('Content blocks', content, (b) => ({
    name: b.key,
    image: b.value,
    gallery: undefined,
    updateData: (data) => prisma.contentBlock.update({ where: { id: b.id }, data: { value: data.image } }),
  }));

  console.log('\nDone.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
