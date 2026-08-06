#!/usr/bin/env bash
# ============================================================
# PE_ORIGINALS — local setup, one shot.
# Run from the project root:  ./setup-local.sh
# Requires: Docker (for Postgres+Redis), Node >= 18.
# ============================================================
set -e  # stop on first real error instead of plowing ahead

echo "==> 1/5  Installing backend dependencies..."
cd backend
npm install

echo "==> 2/5  Starting Postgres + Redis (docker compose)..."
cd ..
if command -v docker >/dev/null 2>&1; then
  docker compose up -d postgres redis
  echo "    Waiting for both to report healthy..."
  for i in $(seq 1 30); do
    PG_OK=$(docker inspect -f '{{.State.Health.Status}}' pe_originals_postgres 2>/dev/null || echo "starting")
    REDIS_OK=$(docker inspect -f '{{.State.Health.Status}}' pe_originals_redis 2>/dev/null || echo "starting")
    if [ "$PG_OK" = "healthy" ] && [ "$REDIS_OK" = "healthy" ]; then
      echo "    Postgres + Redis are healthy."
      break
    fi
    sleep 2
  done
  if [ "$PG_OK" != "healthy" ] || [ "$REDIS_OK" != "healthy" ]; then
    echo "    WARNING: containers didn't report healthy in time — check 'docker compose logs postgres redis'."
  fi
else
  echo "    Docker not found. Install Postgres + Redis yourself and make sure"
  echo "    backend/.env's DATABASE_URL / REDIS_URL point at them, then re-run"
  echo "    this script, or continue manually from step 3 below."
fi

echo "==> 3/5  Running Prisma migrations..."
cd backend
npx prisma migrate dev --name init

echo "==> 4/5  Seeding database (sample products + admin account)..."
npm run seed

echo "==> 5/5  Starting the API (Ctrl+C to stop)..."
echo "    Once it's up: http://localhost:5001/api/health"
echo "    Storefront:   http://localhost:5001/"
echo "    Admin panel:  http://localhost:5001/admin/"
npm run dev
