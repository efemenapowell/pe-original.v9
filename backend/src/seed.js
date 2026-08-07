// ============================================================
// seed.js — populate the database with starter data
//   • Admin account (from .env ADMIN_EMAIL/ADMIN_PASSWORD)
//   • 6 categories
//   • 16 real products (mirrors the original frontend data)
//   • Site content blocks (hero, about, banners…)
//
// Run:  npm run seed   (from backend/)
// ============================================================
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');
const { slugify } = require('./utils/helpers');

async function seed() {
  console.log('🌱 Seeding PE_ORIGINALS database…\n');

  // ---- Admin ----
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@peoriginals.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe_12345';
  const existingAdmin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.admin.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        name: process.env.ADMIN_NAME || 'Store Admin',
        role: 'SUPER_ADMIN',
      },
    });
    console.log(`✅ Admin created: ${adminEmail} (password: ${adminPassword})`);
  } else {
    console.log(`ℹ️  Admin already exists: ${adminEmail}`);
  }

  // ---- Categories ----
  const categoryDefs = [
    { slug: 'dresses', name: 'Dresses', order: 1 },
    { slug: 'tops', name: 'Tops & Blouses', order: 2 },
    { slug: 'bottoms', name: 'Bottoms', order: 3 },
    { slug: 'outerwear', name: 'Outerwear', order: 4 },
    { slug: 'shoes', name: 'Shoes', order: 5 },
    { slug: 'accessories', name: 'Accessories', order: 6 },
  ];
  const catMap = {};
  for (const c of categoryDefs) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name, order: c.order },
    });
    catMap[c.slug] = cat.id;
  }
  console.log(`✅ Categories: ${categoryDefs.length} ready`);

  // ---- Products (real data from the storefront) ----
  const products = [
    {
      name: 'Floral Wrap Midi Dress', brand: 'Zara', price: 48000, originalPrice: 129000,
      category: 'dresses', sizes: ['XS', 'S', 'M', 'L'], soldSizes: ['XL'],
      image: '/images/products/p2.jpg', badge: 'sale', rating: 4.9, reviews: 32,
      condition: 'Excellent — pristine', featured: true,
      description: 'A dreamy floral wrap midi dress in soft blush tones — flattering on every silhouette and perfect for spring garden parties. New, beautifully kept.',
    },
    {
      name: 'Silk Slip Dress', brand: 'Reformation', price: 75000, originalPrice: 218000,
      category: 'dresses', sizes: ['S', 'M'], soldSizes: ['XS', 'L'],
      image: '/images/products/p3.jpg', badge: 'sale', rating: 5.0, reviews: 18,
      condition: 'Like new — no signs of wear', featured: true,
      description: 'Bias-cut 100% silk slip dress with a delicate adjustable strap. The kind of piece that goes from dinner to dancing without missing a beat. Pre-owned, pristine.',
    },
    {
      name: 'Cropped Ribbed Knit Top', brand: 'Aritzia', price: 28000, originalPrice: 68000,
      category: 'tops', sizes: ['XS', 'S', 'M'], soldSizes: ['L'],
      image: '/images/products/p4.jpg', badge: '', rating: 4.7, reviews: 41,
      condition: 'Excellent — lightly handled', featured: true,
      description: 'Buttery-soft ribbed knit in a warm cream. Fitted through the bodice with the perfect crop — a capsule wardrobe staple that layers beautifully.',
    },
    {
      name: 'Wide-Leg High-Waist Trousers', brand: 'COS', price: 39000, originalPrice: 110000,
      category: 'bottoms', sizes: ['S', 'M', 'L'], soldSizes: ['XS'],
      image: '/images/products/p5.jpg', badge: 'sale', rating: 4.8, reviews: 26,
      condition: 'Excellent — dry cleaned', featured: true,
      description: 'Fluid wide-leg trousers with a sculpting high waist. An architectural silhouette in a versatile oat tone — office to evening, effortlessly.',
    },
    {
      name: "Classic Denim Jacket", brand: "Levi's", price: 42000, originalPrice: 98000,
      category: 'outerwear', sizes: ['XS', 'S', 'M', 'L'], soldSizes: [],
      image: '/images/products/p6.jpg', badge: 'new', rating: 4.9, reviews: 53,
      condition: 'Good — broken in, no flaws', featured: true,
      description: 'The forever-wardrobe classic — vintage-inspired denim jacket with just the right amount of character. Softened by wear, structurally sound.',
    },
    {
      name: 'Pleated Midi Skirt', brand: '& Other Stories', price: 32000, originalPrice: 79000,
      category: 'bottoms', sizes: ['XS', 'S'], soldSizes: ['M', 'L'],
      image: '/images/products/p7.jpg', badge: '', rating: 4.6, reviews: 19,
      condition: 'Excellent — beautifully kept', featured: false,
      description: 'Liquid-satin pleated midi that catches the light with every step. Elegant, swishy, and endlessly wearable. New.',
    },
    {
      name: 'Ruffled Blouse', brand: 'Sandro', price: 38000, originalPrice: 145000,
      category: 'tops', sizes: ['S', 'M', 'L'], soldSizes: ['XS'],
      image: '/images/products/p8.jpg', badge: 'sale', rating: 4.8, reviews: 22,
      condition: 'Excellent — no flaws', featured: false,
      description: 'A romantic ruffle-trim blouse in whisper-soft crepe. Feminine without trying too hard — tuck it in or let it float over trousers.',
    },
    {
      name: 'Trench Coat', brand: 'Burberry', price: 180000, originalPrice: 690000,
      category: 'outerwear', sizes: ['M', 'L'], soldSizes: ['S'],
      image: '/images/products/p9.jpg', badge: 'new', rating: 5.0, reviews: 11,
      condition: 'Very good — light vintage wear, fully intact', featured: false,
      description: 'An investment trench in the signature honey colourway. Timeless, structured, and endlessly chic — authenticated and in wonderful condition for its vintage.',
    },
    {
      name: 'Block-Heel Mules', brand: 'By Far', price: 55000, originalPrice: 165000,
      category: 'shoes', sizes: ['36', '37', '38'], soldSizes: ['39'],
      image: '/images/products/p10.jpg', badge: '', rating: 4.7, reviews: 15,
      condition: 'Great — light sole wear', featured: false,
      description: 'Sculptural block-heel mules in glossy black. The perfect transitional shoe — walkable, elegant, and pairs with absolutely everything. EU sizing.',
    },
    {
      name: 'Puffy Shoulder Blazer', brand: 'The Frankie Shop', price: 62000, originalPrice: 175000,
      category: 'outerwear', sizes: ['S', 'M'], soldSizes: ['XS', 'L'],
      image: '/images/products/p11.jpg', badge: 'sale', rating: 4.9, reviews: 38,
      condition: 'Excellent — beautifully kept', featured: false,
      description: 'The viral oversized puffer-shoulder blazer in espresso. Structured power-dressing with a soft feel — the single most versatile piece in this drop.',
    },
    {
      name: 'Sequin Mini Dress', brand: 'Self-Portrait', price: 88000, originalPrice: 320000,
      category: 'dresses', sizes: ['S', 'M'], soldSizes: ['XS'],
      image: '/images/products/p12.jpg', badge: 'new', rating: 4.8, reviews: 9,
      condition: 'Like new — event worn', featured: false,
      description: 'All-over sequin mini with a fitted bodice and flirty hem — made for birthdays, bridal showers, and main-character moments. All sequins intact.',
    },
    {
      name: 'Leather Shoulder Bag', brand: 'Polène', price: 145000, originalPrice: 360000,
      category: 'accessories', sizes: ['One Size'], soldSizes: [],
      image: '/images/products/p13.jpg', badge: 'sale', rating: 5.0, reviews: 27,
      condition: 'Excellent — light use, hardware flawless', featured: true,
      description: 'Sculpted full-grain leather shoulder bag in camel. The cult-favourite silhouette with buttery patina — authenticated, comes with dust bag.',
    },
    {
      name: 'Knit Cardigan', brand: 'Maje', price: 36000, originalPrice: 125000,
      category: 'outerwear', sizes: ['XS', 'S', 'M'], soldSizes: ['L'],
      image: '/images/products/p14.jpg', badge: 'new', rating: 4.7, reviews: 14,
      condition: 'Excellent — pilling-free', featured: false,
      description: 'Chunky knit cardigan in blush pink with delicate pearl buttons. Hygge energy with a Parisian twist — cosy, pretty, and forever in style.',
    },
    {
      name: 'High-Rise Straight Jeans', brand: 'Frame', price: 44000, originalPrice: 128000,
      category: 'bottoms', sizes: ['25', '26', '27', '28'], soldSizes: ['29'],
      image: '/images/products/p15.jpg', badge: '', rating: 4.8, reviews: 31,
      condition: 'Excellent — no fading', featured: false,
      description: 'Clean, straight-leg denim with a perfect high rise. Structured enough to hold its shape, soft enough to live in. Jeans-size waist in inches.',
    },
    {
      name: 'Silk Scarf', brand: 'Hermès', price: 120000, originalPrice: 460000,
      category: 'accessories', sizes: ['One Size'], soldSizes: [],
      image: '/images/products/p1.jpg', badge: 'sold', rating: 5.0, reviews: 6,
      condition: 'Excellent — no pulls, vivid colour', featured: false,
      description: 'Vintage 90cm silk twill scarf with a rare archive print. Vivid, crisp, and fully authenticated — the ultimate forever accessory.',
    },
    {
      name: 'Fitted Bodycon Dress', brand: 'House of CB', price: 52000, originalPrice: 140000,
      category: 'dresses', sizes: ['XS', 'S', 'M'], soldSizes: ['L'],
      image: '/images/products/p16.jpg', badge: '', rating: 4.9, reviews: 44,
      condition: 'Great — beautifully kept, no marks', featured: false,
      description: 'Boned corset bodycon with a sweetheart neckline. Cinches, curves, and commands the room — the little black dress with attitude.',
    },
  ];

  let created = 0;
  for (const p of products) {
    const slug = slugify(p.name);
    const exists = await prisma.product.findUnique({ where: { slug } });
    if (exists) continue;
    await prisma.product.create({
      data: {
        slug,
        name: p.name,
        brand: p.brand,
        description: p.description,
        price: p.price,
        originalPrice: p.originalPrice,
        categoryId: catMap[p.category],
        sizes: p.sizes,
        soldSizes: p.soldSizes,
        image: p.image,
        gallery: [p.image],
        badge: p.badge,
        rating: p.rating,
        reviews: p.reviews,
        condition: p.condition,
        featured: p.featured,
      },
    });
    created++;
  }
  console.log(`✅ Products: ${created} created (${products.length - created} already existed)`);

  // ---- Content blocks (editable site content) ----
  const contentBlocks = [
    { key: 'announce.bar', value: '✨ New arrivals every week ✨', type: 'text' },
    { key: 'hero.kicker', value: 'curated with love,', type: 'text' },
    { key: 'hero.title', value: 'Pre-Loved Designer Fashion for Women', type: 'text' },
    {
      key: 'hero.subtitle',
      value: 'Authentic designer and original-brand pieces — new, beautifully kept, and priced to love. Sustainable luxury, one piece at a time.',
      type: 'text',
    },
    { key: 'hero.cta', value: 'Shop the Drop', type: 'text' },
    { key: 'hero.image', value: 'images/sections/hero.jpg', type: 'image' },
    { key: 'featured.title', value: 'The Edit', type: 'text' },
    { key: 'featured.kicker', value: 'new loves,', type: 'text' },
    { key: 'categories.kicker', value: "what's your mood?", type: 'text' },
    { key: 'categories.title', value: 'Shop by Category', type: 'text' },
    { key: 'story.kicker', value: 'fashion with a heart', type: 'text' },
    { key: 'story.title', value: 'Resale, Reimagined', type: 'text' },
    {
      key: 'story.text',
      value: 'PE_ORIGINALS is a curated women\u2019s clothing boutique — authentic designer and original-brand pieces, new, beautifully priced. Every item is authenticated, cleaned, and ready for its next chapter.',
      type: 'text',
    },
    { key: 'insta.title', value: 'Follow the love', type: 'text' },
    { key: 'newsletter.title', value: 'First Dibs, Always', type: 'text' },
    {
      key: 'newsletter.text',
      value: 'Be the first to see new drops, private sales, and member-only pieces.',
      type: 'text',
    },
    {
      key: 'about.story',
      value: 'Born from a love of beautiful clothes and a frustration with fashion waste, PE_ORIGINALS curates pre-loved designer and high-street pieces — authenticated, refreshed, and ready for new memories.',
      type: 'text',
    },
    {
      key: 'about.values',
      value: '[{"title":"Authenticity First","text":"Every piece is verified before it earns a place on our rails."},{"title":"Sustainability","text":"Resale is the most sustainable fashion choice — we make it beautiful."},{"title":"Fair Prices","text":"Designer quality at a fraction of the original retail price."}]',
      type: 'json',
    },
    {
      key: 'contact.info',
      value: '{"email":"hello@peoriginals.com","phone":"+234 800 000 0000","address":"Lagos, Nigeria","hours":"Mon–Sat, 10am–7pm WAT"}',
      type: 'json',
    },
    // Shipping settings — editable from the admin panel's
    // Settings → Shipping tab (see admin.routes.js content CRUD and
    // backend/src/routes/order.routes.js getShippingSettings()).
    { key: 'shipping.freeThreshold', value: '550000', type: 'text' },
    { key: 'shipping.flatRate', value: '5000', type: 'text' },
  ];

  let blocks = 0;
  for (const b of contentBlocks) {
    await prisma.contentBlock.upsert({
      where: { key: b.key },
      create: b,
      update: { value: b.value, type: b.type },
    });
    blocks++;
  }
  console.log(`✅ Content blocks: ${blocks} ready`);

  // ---- Coupons (sample discount codes for testing) ----
  const couponDefs = [
    {
      code: 'WELCOME10',
      type: 'PERCENTAGE',
      value: 10,
      minOrderAmount: 0,
      maxDiscount: 50000,
      usageLimit: 100,
      validFrom: null,
      validUntil: null,
      isActive: true,
    },
    {
      code: 'SAVE20',
      type: 'PERCENTAGE',
      value: 20,
      minOrderAmount: 100000,
      maxDiscount: 150000,
      usageLimit: 50,
      validFrom: null,
      validUntil: null,
      isActive: true,
    },
    {
      code: 'FLAT5K',
      type: 'FIXED',
      value: 5000,
      minOrderAmount: 50000,
      maxDiscount: 0,
      usageLimit: 0, // unlimited
      validFrom: null,
      validUntil: null,
      isActive: true,
    },
  ];

  let couponsReady = 0;
  for (const c of couponDefs) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      create: c,
      update: {
        type: c.type,
        value: c.value,
        minOrderAmount: c.minOrderAmount,
        maxDiscount: c.maxDiscount,
        usageLimit: c.usageLimit,
        isActive: c.isActive,
      },
    });
    couponsReady++;
  }
  console.log(`✅ Coupons: ${couponsReady} ready (WELCOME10, SAVE20, FLAT5K)`);

  console.log('\n🌱 Seed complete!');
  console.log('   Admin login  → /admin  (see .env ADMIN_EMAIL / ADMIN_PASSWORD)');
  console.log('   API health   → /api/health\n');
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });