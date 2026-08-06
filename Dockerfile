# ============================================================
# PE_ORIGINALS — Dockerfile (Railway / any Docker host)
#
# Single-stage build so the runtime image includes the Prisma CLI
# (needed by `prisma migrate deploy` at boot) and the full source
# layout the app expects (backend/src, frontend/, admin/).
#
# Railway notes:
#   • Railway injects PORT — we bind 0.0.0.0 and read process.env.PORT.
#   • Railway Postgres provides DATABASE_URL automatically.
#   • Redis is OPTIONAL — the app degrades gracefully without it.
#   • Migrations run at container boot (CMD below). For Railway's
#     "pre-deploy command", use:  npx prisma migrate deploy
# ============================================================

FROM node:20-alpine

# Prisma needs OpenSSL at runtime for the query engine
RUN apk add --no-cache openssl tzdata

WORKDIR /app

# ---- Install backend dependencies (includes Prisma CLI) ----
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --no-audit --no-fund || npm install --prefix backend --no-audit --no-fund

# ---- Copy the rest of the source ----
COPY backend/prisma ./backend/prisma
COPY backend/src ./backend/src
COPY backend/.env.example ./backend/.env.example
COPY backend/uploads/.gitkeep ./backend/uploads/.gitkeep

# ---- Frontend + admin (served by Express) ----
COPY frontend ./frontend
COPY admin ./admin

# ---- Root-level convenience files ----
COPY package.json ./

# ---- Generate the Prisma client from the copied schema ----
RUN cd backend && npx prisma generate

# ---- Non-root user for safety ----
RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p backend/uploads \
  && chown -R app:app /app

USER app

ENV NODE_ENV=production
# Railway injects PORT automatically; 5000 is the local fallback.
ENV PORT=5000

EXPOSE 5000

# Boot: apply pending migrations, then start the API (serves
# frontend + admin + /api from the single process).
CMD ["sh", "-c", "cd backend && npx prisma migrate deploy && node src/server.js"]
