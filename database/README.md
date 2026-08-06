# PE_ORIGINALS — Database

PostgreSQL schema managed with **Prisma**. The canonical schema lives at
`backend/prisma/schema.prisma` (this folder mirrors it for reference).

---

## ER Diagram (ASCII)

```
┌──────────────────────────┐        ┌──────────────────────────┐
│          User            │        │          Admin           │
│──────────────────────────│        │──────────────────────────│
│ id            UUID  PK   │        │ id            UUID  PK   │
│ email         UNIQUE     │        │ email         UNIQUE     │
│ passwordHash             │        │ passwordHash             │
│ firstName / lastName     │        │ name                     │
│ phone / address / city   │        │ role  (ADMIN|SUPER_ADMIN)│
│ country                  │        │ isActive                 │
│ emailVerified / isActive │        │ lastLoginAt              │
│ createdAt / updatedAt    │        │ createdAt / updatedAt    │
└──────┬───────────┬───────┘        └──────┬───────────────────┘
       │           │                      │
       │ 1        ∞ │ 1                  ∞ │
       ▼           ▼                      ▼
┌────────────┐ ┌────────────┐   ┌──────────────────┐
│   Cart     │ │   Order    │   │PasswordResetToken│
│────────────│ │────────────│   │──────────────────│
│ id     PK  │ │ id     PK  │   │ id        PK     │
│ userId UNIQ│ │ orderNumber│   │ tokenHash UNIQUE │
│ createdAt  │ │ userId  FK │   │ userId    FK ?   │
│ updatedAt  │ │ status     │   │ adminId   FK ?   │
└─────┬──────┘ │ subtotal   │   │ expiresAt        │
      │ 1      │ shipping   │   │ usedAt           │
      │        │ total      │   │ createdAt        │
      ▼        │ ship* addr │   └──────────────────┘
┌────────────┐ │ payment*   │
│ CartItem   │ │ notes      │
│────────────│ │ createdAt  │
│ id     PK  │ │ updatedAt  │
│ cartId  FK │ └─────┬──────┘
│ productIdFK│       │ 1
│ size       │       │
│ qty        │       ▼
│ UNIQUE     │ ┌────────────┐   ┌──────────────┐
│(cart,prod, │ │ OrderItem  │   │  Category    │
│   size)    │ │────────────│   │──────────────│
└─────┬──────┘ │ id     PK  │   │ id      PK   │
      │        │ orderId FK │   │ slug    UNIQ │
      │ ∞      │ productIdFK│   │ name         │
      ▼        │ name       │   │ image        │
┌────────────┐ │ brand      │   │ order        │
│  Product   │ │ image      │   │ isActive     │
│────────────│ │ size / qty │   └──────┬───────┘
│ id     PK  │ │ price      │          │ 1
│ slug  UNIQ │ │ subtotal   │          │
│ name       │ └────────────┘          ▼ ∞
│ brand      │              ┌──────────────────┐
│ description│              │     Product      │
│ price      │              │──────────────────│
│ originalP. │              │ categoryId  FK ? │
│ sizes JSON │              │ sizes JSON       │
│ soldSizes  │              │ gallery JSON     │
│ image      │              │ badge/rating/…   │
│ gallery    │              │ featured/isActive│
│ badge      │              │ stock            │
│ rating     │              │ createdAt        │
│ reviews    │              └──────────────────┘
│ condition  │
│ featured   │   ┌──────────────────┐
│ isActive   │   │  ContentBlock    │
│ stock      │   │──────────────────│
│ createdAt  │   │ id     PK        │
└────────────┘   │ key     UNIQUE   │  ← "hero.title", "about.text"…
                 │ value   TEXT     │
                 │ type    (text|image|json)
                 │ isActive         │
                 └──────────────────┘
```

### Key design decisions

- **Separate `Admin` table** — store staff are never in the public `User` table;
  admins authenticate with their own JWT type (`type: "admin"`) so a customer
  token can never access admin endpoints (enforced in `middleware/auth.js`).
- **Order items snapshot** product name/brand/image/price at purchase time, so
  orders remain correct even if a product is later edited or deleted.
- **Password reset tokens** store only the SHA-256 hash of the token and are
  single-use with a 30-minute expiry; one table serves both users and admins.
- **JSON fields** (`sizes`, `soldSizes`, `gallery`) keep the flexible product
  shape without extra tables.
- **Indexes** on every filtered/joined column (`email`, `status`, `categoryId`,
  `isActive`, `featured`, `createdAt`, `price`, `brand`, `orderNumber`, …).

---

## Migration Workflow

```bash
# 1. Edit backend/prisma/schema.prisma (the single source of truth)

# 2. From backend/ — create + apply a migration
npx prisma migrate dev --name your_change_name

# 3. Regenerate the client
npx prisma generate

# 4. In production — apply pending migrations (no dev prompt)
npx prisma migrate deploy

# 5. Seed (first run only)
npm run seed
```

> `npm run seed` is idempotent — safe to re-run; it upserts categories and
> content blocks and skips existing products/admins.

---

## Tables at a glance

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `User` | Store customers | email (unique), passwordHash |
| `Admin` | Staff accounts | email (unique), role |
| `Category` | Product groupings | slug (unique), order |
| `Product` | Catalogue items | slug (unique), price, featured |
| `Order` | Checkout results | orderNumber (unique), status, total, discount, couponCode |
| `OrderItem` | Order lines | snapshots + qty/price |
| `Cart` | Per-user cart | userId (unique) |
| `CartItem` | Cart lines | UNIQUE(cartId, productId, size) |
| `PasswordResetToken` | Reset links (users+admins) | tokenHash (unique) |
| `ContentBlock` | Editable site content | key (unique) |
| `Coupon` | Discount codes | code (unique), type (PERCENTAGE\|FIXED), value, usageLimit |

---

## Backup & restore

```bash
pg_dump pe_originals > pe_originals_backup.sql      # backup
psql pe_originals < pe_originals_backup.sql         # restore
```

Schedule nightly dumps (cron) or use your host's managed backups (RDS/Neon/Supabase).