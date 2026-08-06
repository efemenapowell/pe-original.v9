# PE_ORIGINALS — API Reference

Base URL: `http://localhost:5000` (production: your domain)

All responses use a consistent envelope:

```jsonc
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "message": "…", "details": [ … ] } }
```

Auth is sent as: `Authorization: Bearer <accessToken>`

---

## 1. Health

### `GET /api/health`
Uptime + DB/Redis status.

```jsonc
{ "success": true, "data": { "status": "ok", "db": "up", "cache": "up" } }
```

---

## 2. Public catalogue

### `GET /api/products`
List products with filters & pagination. **Cached in Redis (5 min).**

| Query param | Type | Notes |
|---|---|---|
| `page` | int | default 1 |
| `limit` | int | default 24, max 48 |
| `category` | string | category slug |
| `brand` | string | case-insensitive |
| `size` | string | e.g. `M`, `37` |
| `badge` | string | `sale` \| `new` \| `sold` |
| `search` | string | name/brand/description |
| `minPrice` / `maxPrice` | int | Naira |
| `sort` | string | `newest` (default) \| `price-asc` \| `price-desc` \| `rating` \| `featured` |
| `featured` | bool | only featured |

```jsonc
{
  "success": true,
  "data": {
    "items": [ { "id": "uuid", "slug": "floral-wrap-midi-dress", "name": "…",
                 "brand": "Zara", "price": 48000, "originalPrice": 129000,
                 "sizes": ["XS","S","M","L"], "image": "/uploads/…",
                 "badge": "sale", "category": { "slug": "dresses", "name": "Dresses" } } ],
    "pagination": { "page": 1, "limit": 24, "total": 16, "totalPages": 1 }
  }
}
```

### `GET /api/products/featured`
Featured products (max 12). Cached.

### `GET /api/products/:idOrSlug`
Single product + `related` (4 same-category items). Cached.

---

## 3. Categories & content

### `GET /api/categories`
```jsonc
{ "success": true, "data": [ { "id": "uuid", "slug": "dresses", "name": "Dresses",
                               "image": null, "order": 1,
                               "_count": { "products": 4 } } ] }
```

### `GET /api/content`
All active content blocks keyed by `key` (hero, about, banners, newsletter…).

```jsonc
{ "success": true, "data": {
    "hero.title": "Pre-Loved Designer Fashion for Women",
    "hero.subtitle": "…",
    "hero.image": "images/sections/hero.jpg",
    "about.values": [ { "title": "Authenticity First", "text": "…" } ],
    "contact.info": { "email": "hello@peoriginals.com", "phone": "…" }
} }
```

---

## 4. User auth

### `POST /api/auth/register`
```jsonc
// body
{ "email": "girl@example.com", "password": "password123",
  "firstName": "Ada", "lastName": "Okafor", "phone": "+234…" }

// 201
{ "success": true, "data": { "user": { "id": "uuid", "email": "…", "firstName": "Ada" },
                             "accessToken": "…", "refreshToken": "…" } }
```
Rate-limited to 10/min. Password min 8 chars; bcrypt 12 rounds.

### `POST /api/auth/login`
```jsonc
// body
{ "email": "girl@example.com", "password": "password123" }
// 200 → same shape as register
```

### `POST /api/auth/refresh`
```jsonc
// body
{ "refreshToken": "…" }
// 200
{ "success": true, "data": { "accessToken": "…", "refreshToken": "…" } }
```

### `POST /api/auth/logout`
Stateless — client discards tokens. `{ "success": true }`

### `GET /api/auth/me` 🔒
```jsonc
{ "success": true, "data": { "user": { "id": "…", "email": "…", "firstName": "…",
                                       "lastName": "…", "phone": "…", "address": "…",
                                       "city": "…", "country": "…", "createdAt": "…" } } }
```

### `PATCH /api/auth/profile` 🔒
Update `firstName`, `lastName`, `phone`, `address`, `city`, `country`.

### `POST /api/auth/forgot-password`
```jsonc
// body { "email": "girl@example.com" }
// 200 (always — doesn't reveal account existence)
{ "success": true, "data": { "message": "If that email is registered, a reset link has been sent." } }
```

### `POST /api/auth/reset-password`
```jsonc
// body { "token": "from-email-link", "password": "newpassword123" }
// 200
{ "success": true, "data": { "message": "Password updated. You can now sign in." } }
```

---

## 5. Cart (server-side, 🔒 logged-in users)

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/api/cart` | — | Current cart with product details, subtotal, count |
| POST | `/api/cart/items` | `{ productId, size, qty }` | Add item (validates size & stock) |
| PATCH | `/api/cart/items/:id` | `{ qty }` | Update quantity (1–20) |
| DELETE | `/api/cart/items/:id` | — | Remove line item |
| DELETE | `/api/cart` | — | Clear cart |

```jsonc
// GET /api/cart
{ "success": true, "data": {
    "items": [ { "id": "…", "productId": "…", "size": "M", "qty": 2,
                 "product": { "id": "…", "name": "…", "price": 48000, "image": "…" },
                 "lineTotal": 96000 } ],
    "subtotal": 96000, "count": 2 } }
```

> Guests use localStorage carts on the frontend. Checkout accepts `items` for guests.

---

## 6. Orders & checkout

### `POST /api/orders/checkout`
Shipping form → payment → order. Auth **optional** (guests pass `items`).

```jsonc
// body (guest)
{
  "firstName": "Ada", "lastName": "Okafor", "email": "ada@example.com",
  "phone": "+2348000000000", "address": "12 Admiralty Way",
  "city": "Lekki", "state": "Lagos", "zip": "", "country": "Nigeria",
  "notes": "Leave with security",
  "paymentMethod": "CARD",          // CARD | TRANSFER | WHATSAPP
  "couponCode": "WELCOME10",        // optional discount code
  "items": [ { "productId": "uuid", "size": "M", "qty": 1 } ]
}
// body (logged-in) — omit items; server uses the account's cart

// 201
{ "success": true, "data": {
    "order": { "id": "…", "orderNumber": "PE-20260805-A1B2", "status": "PENDING",
               "subtotal": 48000, "shipping": 5000, "discount": 4800,
               "total": 48200, "couponCode": "WELCOME10",
               "items": [ { "name": "…", "size": "M", "qty": 1, "price": 48000 } ],
               "paymentStatus": "PENDING" },
    "message": "Order placed — awaiting payment confirmation" } }
```

Shipping: flat **₦5,000**, **free at/above ₦550,000** subtotal (admin-editable).
Coupon discount is applied after shipping: `total = subtotal + shipping − discount` (never below 0).
Card orders also get `authorizationUrl` for the hosted Paystack page.

### `GET /api/orders` 🔒
Current user's order history (newest first), includes items.

### `GET /api/orders/:id` 🔒
Single order (must belong to the user).

### `GET /api/orders/confirm/:orderNumber`
Public confirmation lookup by human-readable order number.

### `GET /api/orders/verify/:reference`
Verify a Paystack payment by order reference; marks the order **PAID** when the
amount matches. Idempotent.

---

## 6b. Coupons

### `POST /api/coupons/validate` — public
Validate a code against a cart subtotal.

```jsonc
// body { "code": "welcome10", "subtotal": 104000 }
// 200 — valid
{ "success": true, "data": { "valid": true, "code": "WELCOME10", "type": "PERCENTAGE",
                             "value": 10, "discount": 10400,
                             "minOrderAmount": 0, "maxDiscount": 50000 } }
// 4xx — invalid (with a customer-facing message)
{ "success": false, "error": { "message": "This coupon has expired." } }
```

Coupon types: `PERCENTAGE` (% off, capped at `maxDiscount` if set) and `FIXED` (₦ off).
Rules enforced: active, date window (`validFrom`/`validUntil`), usage limit, minimum order.

---

## 6c. Payments (Paystack)

> Requires `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` in `.env`.
> Test with `sk_test_`/`pk_test_` keys first, then flip your Paystack dashboard
> to **Live** and paste `sk_live_`/`pk_live_`. Verify with
> `curl https://api.paystack.co/balance -H "Authorization: Bearer <secret>"`.

### `POST /api/payments/initialize`
Start a Paystack transaction for a CARD order.

```jsonc
// body { "orderId": "uuid", "email": "ada@example.com" }
// 200
{ "success": true, "data": {
    "authorizationUrl": "https://checkout.paystack.com/…",
    "accessCode": "…", "reference": "PE-20260805-A1B2",
    "publicKey": "pk_…" } }
```

### `GET /api/payments/verify/:reference`
Verify the transaction and mark the order **PAID** when successful.

Also available: `POST /api/webhooks/paystack` — Paystack's server-to-server
webhook (signature-verified HMAC SHA-512) that marks orders paid even if the
customer closes the browser after paying.

---

## 7. Admin auth

### `POST /api/admin/auth/login`
```jsonc
// body { "email": "admin@peoriginals.com", "password": "ChangeMe_12345" }
// 200
{ "success": true, "data": { "admin": { "id": "…", "email": "…", "name": "…", "role": "SUPER_ADMIN" },
                             "accessToken": "…", "refreshToken": "…" } }
```

### `POST /api/admin/auth/refresh` · `GET /api/admin/auth/me` 🔒
Same pattern as user auth.

### `POST /api/admin/auth/forgot-password` · `POST /api/admin/auth/reset-password`
Same pattern as user flow (reset page: `/admin/reset-password.html?token=…`).

---

## 8. Admin API (all 🔒 ADMIN JWT, rate-limited 60/min)

### Products
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/products?page&limit&search&category` | includes inactive |
| POST | `/api/admin/products` | multipart `images` (≤8) + JSON fields |
| PUT | `/api/admin/products/:id` | same as POST |
| DELETE | `/api/admin/products/:id` | soft delete (`isActive: false`) |

Product fields: `name, brand, price, originalPrice, categoryId, sizes[],
soldSizes[], image, gallery[], badge, rating, reviews, condition, featured, isActive, stock, description`.

### Categories
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/categories` | |
| POST | `/api/admin/categories` | multipart `image` + `name, slug, order, isActive` |
| PUT | `/api/admin/categories/:id` | |
| DELETE | `/api/admin/categories/:id` | |

### Content blocks
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/content` | all blocks |
| POST | `/api/admin/content` | upsert by `key`: `{ key, value, type, isActive }` |
| PUT | `/api/admin/content/:key` | |
| DELETE | `/api/admin/content/:key` | |

### Orders
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/orders?page&limit&status` | includes customer info |
| GET | `/api/admin/orders/:id` | full detail |
| PATCH | `/api/admin/orders/:id/status` | `{ status, paymentStatus? }` — PENDING/PAID/SHIPPED/DELIVERED/CANCELLED |

### Coupons
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/coupons?page&limit&search` | all coupons |
| POST | `/api/admin/coupons` | create: `{ code, type, value, minOrderAmount, maxDiscount, usageLimit, validFrom, validUntil, isActive }` |
| PUT | `/api/admin/coupons/:id` | update |
| PATCH | `/api/admin/coupons/:id/toggle` | activate/deactivate |
| DELETE | `/api/admin/coupons/:id` | delete (orders keep their snapshot) |

### Customers
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/users?page&limit&search` | email/name search + order counts |

---

## HTTP status codes used

| Code | Meaning |
|---|---|
| 200 / 201 | OK / Created |
| 400 | Validation failed (Zod) or bad request |
| 401 | Missing/expired/invalid token |
| 403 | Insufficient role |
| 404 | Not found |
| 409 | Duplicate (e.g. email already registered) |
| 429 | Rate limited |

---

## Example: full checkout flow with curl

```bash
# 1. Register / login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"girl@example.com","password":"password123"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.accessToken))")

# 2. Add to cart
PRODUCT=$(curl -s "http://localhost:5000/api/products?limit=1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.items[0].id))")
curl -s -X POST http://localhost:5000/api/cart/items \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"productId\":\"$PRODUCT\",\"size\":\"M\",\"qty\":1}"

# 3. Checkout
curl -s -X POST http://localhost:5000/api/orders/checkout \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Ada","lastName":"Okafor","email":"girl@example.com","phone":"+2348000000000","address":"12 Admiralty Way","city":"Lekki","state":"Lagos"}'
```