// ============================================================
// lib/prisma.js — single PrismaClient instance
// A single instance is required in production to avoid
// exhausting Postgres connection pools.
// ============================================================
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
});

module.exports = prisma;
