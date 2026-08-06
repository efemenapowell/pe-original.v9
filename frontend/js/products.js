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

const PRODUCTS = [
  {
    id: 1,
    name: "Floral Wrap Midi Dress",
    brand: "Zara",
    price: 48000,
    originalPrice: 129000,
    category: "dresses",
    sizes: ["XS", "S", "M", "L"],
    soldSizes: ["XL"],
    image: "images/products/p2.jpg",
    gallery: ["images/products/p2.jpg"],
    description:
      "A dreamy floral wrap midi dress in soft blush tones — flattering on every silhouette and perfect for spring garden parties. New, beautifully kept.",
    badge: "sale",
    rating: 4.9,
    reviews: 32,
    condition: "Excellent — pristine",
    featured: true,
  },
  {
    id: 2,
    name: "Silk Slip Dress",
    brand: "Reformation",
    price: 75000,
    originalPrice: 218000,
    category: "dresses",
    sizes: ["S", "M"],
    soldSizes: ["XS", "L"],
    image: "images/products/p3.jpg",
    gallery: ["images/products/p3.jpg"],
    description:
      "Bias-cut 100% silk slip dress with a delicate adjustable strap. The kind of piece that goes from dinner to dancing without missing a beat. Pre-owned, pristine.",
    badge: "sale",
    rating: 5.0,
    reviews: 18,
    condition: "Like new — no signs of wear",
    featured: true,
  },
  {
    id: 3,
    name: "Cropped Ribbed Knit Top",
    brand: "Aritzia",
    price: 28000,
    originalPrice: 68000,
    category: "tops",
    sizes: ["XS", "S", "M"],
    soldSizes: ["L"],
    image: "images/products/p4.jpg",
    gallery: ["images/products/p4.jpg"],
    description:
      "Buttery-soft ribbed knit in a warm cream. Fitted through the bodice with the perfect crop — a capsule wardrobe staple that layers beautifully.",
    badge: "",
    rating: 4.7,
    reviews: 41,
    condition: "Excellent — lightly handled",
    featured: true,
  },
  {
    id: 4,
    name: "Wide-Leg High-Waist Trousers",
    brand: "COS",
    price: 39000,
    originalPrice: 110000,
    category: "bottoms",
    sizes: ["S", "M", "L"],
    soldSizes: ["XS"],
    image: "images/products/p5.jpg",
    gallery: ["images/products/p5.jpg"],
    description:
      "Fluid wide-leg trousers with a sculpting high waist. An architectural silhouette in a versatile oat tone — office to evening, effortlessly.",
    badge: "sale",
    rating: 4.8,
    reviews: 26,
    condition: "Excellent — dry cleaned",
    featured: true,
  },
  {
    id: 5,
    name: "Classic Denim Jacket",
    brand: "Levi's",
    price: 42000,
    originalPrice: 98000,
    category: "outerwear",
    sizes: ["XS", "S", "M", "L"],
    soldSizes: [],
    image: "images/products/p6.jpg",
    gallery: ["images/products/p6.jpg"],
    description:
      "The forever-wardrobe classic — vintage-inspired denim jacket with just the right amount of character. Softened by wear, structurally sound.",
    badge: "new",
    rating: 4.9,
    reviews: 53,
    condition: "Good — broken in, no flaws",
    featured: true,
  },
  {
    id: 6,
    name: "Pleated Midi Skirt",
    brand: "& Other Stories",
    price: 32000,
    originalPrice: 79000,
    category: "bottoms",
    sizes: ["XS", "S"],
    soldSizes: ["M", "L"],
    image: "images/products/p7.jpg",
    gallery: ["images/products/p7.jpg"],
    description:
      "Liquid-satin pleated midi that catches the light with every step. Elegant, swishy, and endlessly wearable. New.",
    badge: "",
    rating: 4.6,
    reviews: 19,
    condition: "Excellent — beautifully kept",
    featured: false,
  },
  {
    id: 7,
    name: "Ruffled Blouse",
    brand: "Sandro",
    price: 38000,
    originalPrice: 145000,
    category: "tops",
    sizes: ["S", "M", "L"],
    soldSizes: ["XS"],
    image: "images/products/p8.jpg",
    gallery: ["images/products/p8.jpg"],
    description:
      "A romantic ruffle-trim blouse in whisper-soft crepe. Feminine without trying too hard — tuck it in or let it float over trousers.",
    badge: "sale",
    rating: 4.8,
    reviews: 22,
    condition: "Excellent — no flaws",
    featured: false,
  },
  {
    id: 8,
    name: "Trench Coat",
    brand: "Burberry",
    price: 180000,
    originalPrice: 690000,
    category: "outerwear",
    sizes: ["M", "L"],
    soldSizes: ["S"],
    image: "images/products/p9.jpg",
    gallery: ["images/products/p9.jpg"],
    description:
      "An investment trench in the signature honey colourway. Timeless, structured, and endlessly chic — authenticated and in wonderful condition for its vintage.",
    badge: "new",
    rating: 5.0,
    reviews: 11,
    condition: "Very good — light vintage wear, fully intact",
    featured: false,
  },
  {
    id: 9,
    name: "Block-Heel Mules",
    brand: "By Far",
    price: 55000,
    originalPrice: 165000,
    category: "shoes",
    sizes: ["36", "37", "38"],
    soldSizes: ["39"],
    image: "images/products/p10.jpg",
    gallery: ["images/products/p10.jpg"],
    description:
      "Sculptural block-heel mules in glossy black. The perfect transitional shoe — walkable, elegant, and pairs with absolutely everything. EU sizing.",
    badge: "",
    rating: 4.7,
    reviews: 15,
    condition: "Great — light sole wear",
    featured: false,
  },
  {
    id: 10,
    name: "Puffy Shoulder Blazer",
    brand: "The Frankie Shop",
    price: 62000,
    originalPrice: 175000,
    category: "outerwear",
    sizes: ["S", "M"],
    soldSizes: ["XS", "L"],
    image: "images/products/p11.jpg",
    gallery: ["images/products/p11.jpg"],
    description:
      "The viral oversized puffer-shoulder blazer in espresso. Structured power-dressing with a soft feel — the single most versatile piece in this drop.",
    badge: "sale",
    rating: 4.9,
    reviews: 38,
    condition: "Excellent — beautifully kept",
    featured: false,
  },
  {
    id: 11,
    name: "Sequin Mini Dress",
    brand: "Self-Portrait",
    price: 88000,
    originalPrice: 320000,
    category: "dresses",
    sizes: ["S", "M"],
    soldSizes: ["XS"],
    image: "images/products/p12.jpg",
    gallery: ["images/products/p12.jpg"],
    description:
      "All-over sequin mini with a fitted bodice and flirty hem — made for birthdays, bridal showers, and main-character moments. All sequins intact.",
    badge: "new",
    rating: 4.8,
    reviews: 9,
    condition: "Like new — event worn",
    featured: false,
  },
  {
    id: 12,
    name: "Leather Shoulder Bag",
    brand: "Polène",
    price: 145000,
    originalPrice: 360000,
    category: "accessories",
    sizes: ["One Size"],
    soldSizes: [],
    image: "images/products/p13.jpg",
    gallery: ["images/products/p13.jpg"],
    description:
      "Sculpted full-grain leather shoulder bag in camel. The cult-favourite silhouette with buttery patina — authenticated, comes with dust bag.",
    badge: "sale",
    rating: 5.0,
    reviews: 27,
    condition: "Excellent — light use, hardware flawless",
    featured: true,
  },
  {
    id: 13,
    name: "Knit Cardigan",
    brand: "Maje",
    price: 36000,
    originalPrice: 125000,
    category: "outerwear",
    sizes: ["XS", "S", "M"],
    soldSizes: ["L"],
    image: "images/products/p14.jpg",
    gallery: ["images/products/p14.jpg"],
    description:
      "Chunky knit cardigan in blush pink with delicate pearl buttons. Hygge energy with a Parisian twist — cosy, pretty, and forever in style.",
    badge: "new",
    rating: 4.7,
    reviews: 14,
    condition: "Excellent — pilling-free",
    featured: false,
  },
  {
    id: 14,
    name: "High-Rise Straight Jeans",
    brand: "Frame",
    price: 44000,
    originalPrice: 128000,
    category: "bottoms",
    sizes: ["25", "26", "27", "28"],
    soldSizes: ["29"],
    image: "images/products/p15.jpg",
    gallery: ["images/products/p15.jpg"],
    description:
      "Clean, straight-leg denim with a perfect high rise. Structured enough to hold its shape, soft enough to live in. Jeans-size waist in inches.",
    badge: "",
    rating: 4.8,
    reviews: 31,
    condition: "Excellent — no fading",
    featured: false,
  },
  {
    id: 15,
    name: "Silk Scarf",
    brand: "Hermès",
    price: 120000,
    originalPrice: 460000,
    category: "accessories",
    sizes: ["One Size"],
    soldSizes: [],
    image: "images/products/p1.jpg",
    gallery: ["images/products/p1.jpg"],
    description:
      "Vintage 90cm silk twill scarf with a rare archive print. Vivid, crisp, and fully authenticated — the ultimate forever accessory.",
    badge: "sold",
    rating: 5.0,
    reviews: 6,
    condition: "Excellent — no pulls, vivid colour",
    featured: false,
  },
  {
    id: 16,
    name: "Fitted Bodycon Dress",
    brand: "House of CB",
    price: 52000,
    originalPrice: 140000,
    category: "dresses",
    sizes: ["XS", "S", "M"],
    soldSizes: ["L"],
    image: "images/products/p16.jpg",
    gallery: ["images/products/p16.jpg"],
    description:
      "Boned corset bodycon with a sweetheart neckline. Cinches, curves, and commands the room — the little black dress with attitude.",
    badge: "",
    rating: 4.9,
    reviews: 44,
    condition: "Great — beautifully kept, no marks",
    featured: false,
  },
];

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