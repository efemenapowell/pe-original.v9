# PE_ORIGINALS — Full-Stack E-Commerce Platform

[![Railway Ready](https://img.shields.io/badge/Railway-ready-0b0d0e?logo=railway)](HOSTING.md)

A production-ready fashion e-commerce platform: **Express + PostgreSQL + Prisma +
optional Redis** backend, static storefront, and a protected admin panel — all in
one deployable service.

```
pe-originals-fullstack/
├── backend/          Express + Prisma REST API (auth, products, cart, orders, admin)
│   ├── prisma/       Database schema + migrations
│   ├── src/
│   │   ├── config/   Env configuration
│   │   ├── lib/      Prisma client + Redis cache layer
│   │   ├── middleware/  JWT auth, roles, rate limiting, validation, uploads
│   │   ├── routes/   All API route modules
│   │   ├── services/ Auth, tokens, email
│   │   ├── utils/    Helpers
│   │   └── server.js Entry point
│   └── uploads/      Uploaded product images (created at runtime)
├── frontend/         The storefront (5 pages, static-first, API-enhanced)
│   ├── css/          style.css, animations.css, auth.css
│   ├── js/           products.js, api.js, auth.js, checkout.js, main.js…
│   └── images/       logo, product photos, section imagery
├── admin/            Protected admin panel (login + dashboard)
│   ├── css/          admin.css
│   └── js/           admin-api.js, admin.js
├── database/         Schema reference + ER diagram
├── docker-compose.yml  Postgres + Redis for local dev
└── package.json      Root convenience scripts
```

---

## 🚀 Quick Start (local development)

**Prerequisites:** Node.js ≥ 18, PostgreSQL (or Docker).

### Option A — Docker (easiest)

```bash
# 1. Start Postgres + Redis
docker compose up -d --build
# → storefront + admin on http://localhost:5000
# → Postgres on :5432 · Redis on :6379
# → migrations + seed run inside the container on first boot
```

### Option B — Manual Postgres

```bash
# 1. Create a database (Postgres must be running)
createdb pe_originals   # or via psql: CREATE DATABASE pe_originals;

# 2. Backend
cd backend
cp .env.example .env    # then edit DATABASE_URL, secrets, etc.
npm install
npx prisma migrate deploy   # apply migrations
npm run seed                # admin + categories + products + coupons

# 3. Run (from repo root)
npm start               # → http://localhost:5000  (server binds 0.0.0.0, PORT from env)
```

### Open the store

| What | URL |
|------|-----|
| Storefront | http://localhost:5000 |
| Admin panel | http://localhost:5000/admin |
| API health | http://localhost:5000/api/health |

**Default admin login** (from seed):
- Email: `admin@peoriginals.com`
- Password: `ChangeMe_12345`

> ⚠️ Change this immediately after your first login (or set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` before seeding).

---

## 🔐 Features

### Storefront (frontend/)
- 5 pages: Home, Shop (filters/sort/search), Product detail, About, Contact
- Working cart drawer (add / qty / remove / free-shipping progress), persisted in localStorage
- **Login / Signup / Forgot-password modals** wired to the API (JWT)
- **Full checkout flow**: cart → shipping → payment → confirmation
- Products load from the API with **graceful fallback** to the bundled static catalogue (the site never breaks)
- Lazy-loaded images, minimal animations, `prefers-reduced-motion` support

### Admin panel (admin/)
- **Protected route** — every request requires an ADMIN JWT; regular users can never reach it
- Dashboard: product/order/customer counts, quick links
- **Products**: list, search, add, edit, image upload (multer), soft-delete, featured/badge/stock
- **Orders**: list with status filter, detail view, status updates (PENDING → PAID → SHIPPED → DELIVERED)
- **Categories**: add/edit/delete with images
- **Site Content**: edit hero, about, banner & newsletter text blocks (stored in `ContentBlock`)
- **Coupons**: create, edit, activate/deactivate & delete discount codes (type, value, min order, usage limit, expiry)
- **Customers**: browse registered users with order counts

### Backend (backend/)
- **Auth**: register, login, refresh tokens, logout, JWT access (15m) + refresh (30d)
- **Password reset for BOTH users and admins** — email link with a hashed, 30-minute one-time token
- **Products API**: list with filters (category, brand, size, price, sort, search) + pagination, detail with related items, featured
- **Server-side cart** for logged-in users (guests keep localStorage cart)
- **Checkout**: order creation with shipping snapshot, line items, totals, free-shipping logic, email confirmation
- **Email service**: Nodemailer (SMTP). In dev (`MAIL_DEV_MODE=true`) emails are printed to the console — no SMTP needed locally
- **Security**: helmet, CORS allowlist, rate limiting (global + auth + admin), input validation (Zod), bcrypt (12 rounds), hashed reset tokens
- **Caching**: Redis with in-memory graceful fallback; public GET endpoints cached (5 min TTL), invalidated on writes

---

## 🔌 API Reference

All responses: `{ "success": true, "data": … }` — errors: `{ "success": false, "error": { "message": … } }`

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server + DB + cache status |
| GET | `/api/products` | List (query: `page, limit, category, brand, size, badge, search, minPrice, maxPrice, sort`) |
| GET | `/api/products/featured` | Featured products |
| GET | `/api/products/:idOrSlug` | Product detail + related |
| GET | `/api/categories` | Active categories with counts |
| GET | `/api/content` | Editable site content (hero, banners…) |

### User auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | `{ email, password, firstName?, lastName?, phone? }` |
| POST | `/api/auth/login` | `{ email, password }` → access + refresh |
| POST | `/api/auth/refresh` | `{ refreshToken }` → new token pair |
| POST | `/api/auth/forgot-password` | `{ email }` → sends reset link |
| POST | `/api/auth/reset-password` | `{ token, password }` |
| GET | `/api/auth/me` | 🔒 current user |
| PATCH | `/api/auth/profile` | 🔒 update profile |

### Cart & orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cart` | 🔒 my cart with product details |
| POST | `/api/cart/items` | 🔒 `{ productId, size, qty }` |
| PATCH | `/api/cart/items/:id` | 🔒 `{ qty }` |
| DELETE | `/api/cart/items/:id` | 🔒 remove item |
| DELETE | `/api/cart` | 🔒 clear cart |
| POST | `/api/orders/checkout` | 🔓 `{ firstName, lastName, email, phone, address, city, state, …, items?, paymentMethod }` (auth optional — guests pass `items`) |
| GET | `/api/orders` | 🔒 my orders |
| GET | `/api/orders/confirm/:orderNumber` | Public order confirmation |

### Admin (all 🔒 ADMIN JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/auth/login` | Admin sign-in |
| POST | `/api/admin/auth/forgot-password` | Admin reset email |
| POST | `/api/admin/auth/reset-password` | `{ token, password }` |
| GET | `/api/admin/products` | List all (incl. inactive), search |
| POST | `/api/admin/products` | Create (multipart image upload) |
| PUT | `/api/admin/products/:id` | Update |
| DELETE | `/api/admin/products/:id` | Soft delete |
| GET/POST/PUT/DELETE | `/api/admin/categories` | Category CRUD |
| GET/POST/PUT/DELETE | `/api/admin/content` | Content block CRUD (upsert by key) |
| GET/POST/PUT/DELETE | `/api/admin/coupons` | Coupon CRUD (list/create/update/toggle/delete) |
| GET | `/api/admin/orders` | List orders (status filter) |
| GET | `/api/admin/orders/:id` | Order detail |
| PATCH | `/api/admin/orders/:id/status` | `{ status, paymentStatus? }` |
| GET | `/api/admin/users` | List customers |

---

## 🧱 Database Schema

Models: `User`, `Admin`, `Category`, `Product`, `Order`, `OrderItem`, `Cart`, `CartItem`, `PasswordResetToken`, `ContentBlock`, `Coupon`.

- Orders snapshot product name/brand/image/price at purchase time → immune to later edits
- Password reset tokens store only SHA-256 hashes
- All hot query paths indexed (`email`, `status`, `categoryId`, `isActive`, `featured`, `createdAt`, `price`, `brand`)
- See `database/README.md` for the full ER diagram & migration workflow

---

## 🧪 Testing the stack

```bash
# from backend/
curl http://localhost:5000/api/health
curl "http://localhost:5000/api/products?limit=5"
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"Password123!"}'
```

---

## 📈 Scaling to 1M+ monthly visits

The architecture is built to absorb ~33K requests/day (peaks much higher) without
special effort, and to scale linearly when needed:

**Out of the box**
- **Read caching**: Redis-cached products/categories/content (5-min TTL, invalidated on writes). At 1M visits, >90% of product reads never touch Postgres.
- **Compression + static max-age**: gzip on all JSON; 7-day immutable cache for uploads; 1-hour for static assets.
- **Indexed queries**: every filter/sort path in the Prisma schema has a matching index.
- **Rate limiting**: per-IP limits on API + stricter auth limits (brute-force protection).
- **Lean frontend**: lazy images, no heavy animation, small JS — fast Time-to-Interactive on mobile.

**When you grow**
1. **Add a reverse proxy/CDN** (Cloudflare, CloudFront) in front of the API — cache `/api/products` and `/api/content` at the edge for your region.
2. **Horizontal scaling**: the API is stateless (JWT auth) — run N instances behind a load balancer (`npm start` in each). Postgres stays the single source of truth.
3. **Managed Postgres**: move to RDS/Neon/Supabase with connection pooling (PgBouncer) — set `DATABASE_URL` to the pooled endpoint.
4. **Managed Redis** (Upstash/ElastiCache) — set `REDIS_URL`; the app auto-detects it.
5. **Media CDN**: ✅ done — `middleware/uploadS3.js` uploads admin images straight to the Railway bucket (S3-compatible) and stores the full public URL in the `image`/`gallery` fields. The old local-disk `middleware/upload.js` is unused/dead code and can be deleted. If any product/category/content record still has an old `/uploads/...` path (from before this migration), run `node src/migrate-images-to-s3.js` (see that file's header for details) — those old files are unrecoverable from local disk since Railway's filesystem is ephemeral, so it audits + best-effort matches against what's currently in the bucket, and flags anything that needs a manual re-upload via `/admin`.
6. **Queue order emails** (BullMQ/Resend) so SMTP latency never blocks checkout — emails are already fire-and-forget.
7. **Database maintenance (~once a year)**: run `VACUUM ANALYZE` (or rely on autovacuum) and `prisma migrate deploy` after upgrading deps. With the above architecture, no schema work is expected more often.

---

## 🔐 Environment Variables (backend/.env)

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | API port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_ACCESS_SECRET` | Sign access tokens | change me! |
| `JWT_REFRESH_SECRET` | Sign refresh tokens | change me! |
| `JWT_ACCESS_TTL` | Access token lifetime | `15m` |
| `JWT_REFRESH_TTL` | Refresh token lifetime | `7d` |
| `CORS_ORIGINS` | Allowed origins (comma-sep) | `http://localhost:5500` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `REDIS_CACHE_TTL` | Cache TTL (seconds) | `300` |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Email sending | SMTP or dev-mode |
| `MAIL_DEV_MODE` | `true` = log emails to console | `false` |
| `PUBLIC_URL` | Base URL for reset links | `http://localhost:5000` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded admin credentials | — |
| `RATE_LIMIT_*` | Rate-limit windows | sensible defaults |

---

## 🖼️ Managing Products

**From the admin panel** (recommended): sign in at `/admin` → Products → Add/Edit →
upload photos, set price/category/sizes/badge/featured → Save. Changes appear on
the storefront immediately (product cache is invalidated on write).

**From code** (if you prefer): edit `frontend/js/products.js` to change the
*static fallback* catalogue, and/or edit `backend/prisma/seed.js` to change what
`npm run seed` inserts into the database.

---

## 🚂 Deploying on Railway

Railway builds this repo with the bundled `Dockerfile` — **one click**, no config.
The container serves the API + frontend + admin + uploads from a single process,
applies migrations at boot, and reads all settings from Railway env vars.

**Steps (full detail in [`HOSTING.md`](HOSTING.md) §3):**

1. Push this repo to GitHub → Railway → **New Project → Deploy from GitHub repo**.
2. **New → Database → PostgreSQL** — Railway injects `DATABASE_URL` automatically.
3. Set env vars (service → Variables): `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
   `PUBLIC_URL` (your Railway URL), `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
   `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`. Redis is optional (`REDIS_URL`).
4. **Deploy.** Migrations run at boot; seed once via
   `railway run "cd backend && node src/seed.js"`.
5. Open the generated domain: `/` storefront · `/admin/` panel · `/api/health` health.

> **Redis on Railway is optional.** Leave `REDIS_URL` empty and the app runs
> perfectly — the cache layer degrades gracefully (verified). Add the Railway
> Redis plugin later and set `REDIS_URL` to re-enable caching with no code change.

---

## 🐙 GitHub Setup & .gitignore

The repo ships with layered `.gitignore` files so pushing to GitHub is **secret-safe by default**:

| File | Protects |
|---|---|
| `.gitignore` (root) | `node_modules/` (all levels), `.env` + all variants (keeps `.env.example`), `dist/`, `build/`, `coverage/`, `.cache`, logs, `*.zip`, OS/editor files (`.DS_Store`, `.vscode/`, `.idea/`, `*.swp`…) |
| `backend/.gitignore` | backend `node_modules/`, `.env`, `uploads/*` (keeps `.gitkeep`), Prisma generated client, local DB files |
| `frontend/.gitignore` | frontend `node_modules/`, `dist/`, `build/`, `uploads/*` |
| `admin/.gitignore` | admin `node_modules/`, `dist/`, `build/` |

**Never commit real secrets** — `.env` (with real Paystack keys / admin credentials) is always ignored; only `.env.example` with placeholders is tracked. Verify locally with:

```bash
git check-ignore backend/.env          # → backend/.gitignore:10:.env   (ignored ✓)
git check-ignore backend/.env.example  # → no output                     (tracked ✓)
git status                             # only source files appear
```

Quick GitHub push:

```bash
git init && git add -A && git commit -m "PE_ORIGINALS full-stack"
git branch -M main && git remote add origin <your-repo-url>
git push -u origin main
```

> ⚠️ `.env` files are **never** pushed. On any new machine: `cp backend/.env.example backend/.env` and fill in real values (see HOSTING.md).

---

## 🤝 Support & License

Built for PE_ORIGINALS. MIT licensed. See `backend/package.json` for dependencies.
