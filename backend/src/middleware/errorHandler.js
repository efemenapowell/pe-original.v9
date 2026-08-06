// ============================================================
// middleware/errorHandler.js
// Central error handling — catches Zod validation errors,
// Prisma known errors, and unexpected errors. Always returns
// a JSON payload with a consistent shape.
// ============================================================
const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      },
    });
  }

  // Prisma known errors (e.g. unique constraint)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: { message: `Duplicate value for field(s): ${err.meta?.target?.join(', ') || 'unknown'}` },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, error: { message: 'Record not found' } });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ success: false, error: { message: 'Related record does not exist' } });
    }
  }

  // Our own API errors
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Multer errors
  if (err && err.code && typeof err.code === 'string' && err.code.startsWith('LIMIT_')) {
    return res.status(400).json({ success: false, error: { message: `Upload error: ${err.code}` } });
  }

  // Unknown — log server-side, hide details from client
  console.error('[error]', err);
  return res.status(500).json({
    success: false,
    error: { message: 'Internal server error' },
  });
}

module.exports = { ApiError, notFound, errorHandler };
