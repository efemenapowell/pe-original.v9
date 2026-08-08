/* ==========================================================
   PE_ORIGINALS — products.js
   ⭐ PRODUCT DATA — EDIT THIS FILE to manage your store ⭐
   ==========================================================

   HOW TO ADD A NEW PRODUCT
   ────────────────────────
   Copy one object below (from { to }), paste it inside the
   PRODUCTS array (before the closing ]), and fill in:

   {
     id: 13,                          // unique number — increment from last
     name: 'Floral Midi Dress',       // product title shown on cards
     brand: 'Zara',                   // original brand name
     price: 45,                       // YOUR selling price (number only)
     originalPrice: 120,              // original retail price (0 = no sale)
     category: 'dresses',             // 'dresses' | 'tops' | 'bottoms' | 'outerwear' | 'shoes' | 'accessories'
     sizes: ['XS','S','M'],           // available sizes (SOLD size = omit it)
     soldSizes: ['L'],                // optional: sizes already sold (shown crossed-out)
    image: 'images/products/p14.jpg',
    gallery: ['images/products/p14.jpg'],
     description: 'A lovely floral midi dress in soft blush tones, perfect for spring evenings. New, excellent condition.',
     badge: 'new',                    // 'sale' | 'new' | 'sold' | '' (empty = no badge)
     rating: 4.8,                     // star rating 0–5
     reviews: 14,                     // review count
     condition: 'Excellent — pristine',  // condition note shown on product page
     featured: true                   // true = appears in "Featured" on home page
   },

   ⚠️  RULES
   • id MUST be unique
   • category must match one of: dresses, tops, bottoms, outerwear, shoes, accessories
   • price & originalPrice are NUMBERS (no $ sign)
   • to mark sold out → badge: 'sold' AND remove from sizes (or list in soldSizes)
   • leave featured: false (or omit) for products that should only show in shop
   ========================================================== */

const PRODUCTS = [];
// ⚠️ Demo/stock catalog removed on purpose — this store now runs
// entirely on real products added through the Admin panel. This
// array stays empty; api-bootstrap.js fills window.PRODUCTS from
// your live database once the page loads.


/* ── Helpers (do not edit below unless you know what you're doing) ── */
const CATEGORIES = [
  { id: "dresses", label: "Dresses" },
  { id: "tops", label: "Tops & Blouses" },
  { id: "bottoms", label: "Bottoms" },
  { id: "outerwear", label: "Outerwear" },
  { id: "shoes", label: "Shoes" },
  { id: "accessories", label: "Accessories" },
];

const BRANDS = [...new Set(PRODUCTS.map((p) => p.brand))].sort();

function getProductById(id) {
  return PRODUCTS.find((p) => p.id === Number(id)) || null;
}

function getFeaturedProducts(limit = 8) {
  return PRODUCTS.filter((p) => p.featured && p.badge !== "sold").slice(
    0,
    limit,
  );
}

function getRelatedProducts(product, limit = 4) {
  return PRODUCTS.filter(
    (p) =>
      p.id !== product.id &&
      p.badge !== "sold" &&
      (p.category === product.category || p.brand === product.brand),
  ).slice(0, limit);
}

function getCategoryLabel(catId) {
  const c = CATEGORIES.find((c) => c.id === catId);
  return c ? c.label : catId;
}

function formatPrice(amount) {
  return (
    "₦" +
    Number(amount).toLocaleString("en-NG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

// ── Live catalogue registry ────────────────────────────────
// Expose the arrays on window so js/api-bootstrap.js can merge
// backend products into the SAME references main.js reads.
// (Keep everything else closure-private.)
window.PRODUCTS = PRODUCTS;
window.CATEGORIES = CATEGORIES;
window.BRANDS = BRANDS;