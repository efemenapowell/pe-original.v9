// ============================================================
// server.js — Express app entry point
// Wires middleware, static serving, API routes, error handling.
// ============================================================
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const config = require('./config');
const { globalLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// ---- Security & parsing middleware ----
app.disable('x-powered-by');
app.use(
  helmet({
    // The storefront is a classic HTML site with inline handlers
    // (onclick=...) — allow inline scripts/styles, but keep the
    // CSP strict about *external* script origins (only CDN + self).
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://js.paystack.co'],
        scriptSrcAttr: ["'unsafe-inline'"], // classic storefront uses onclick= inline handlers
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https://api.paystack.co'],
        // Paystack Inline renders its payment form in an iframe:
        frameSrc: ["'self'", 'https://paystack.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", 'https://paystack.com'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin(origin, cb) {
      // Allow no-origin requests (curl, same-origin, mobile apps)
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(compression()); // gzip responses — huge win for JSON + static

// Webhooks must be mounted BEFORE the global JSON parser below —
// they verify Paystack's signature against the raw request body,
// which express.json() would otherwise already have consumed.
app.use('/api/webhooks', require('./routes/webhook.routes'));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---- Static files ----
// Uploaded images: /uploads/...
app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', immutable: true }));

// Frontend (built site): / → frontend/ folder
const frontendDir = path.join(__dirname, '../../frontend');
app.use(express.static(frontendDir, { maxAge: '1h' }));

// Admin panel: /admin → admin/ folder
const adminDir = path.join(__dirname, '../../admin');
app.use('/admin', express.static(adminDir, { maxAge: '1h' }));

// ---- API routes ----
app.use('/api', globalLimiter);
app.use('/api/health', require('./routes/health.routes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin/auth', require('./routes/adminAuth.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/categories', require('./routes/category.routes'));
app.use('/api/content', require('./routes/content.routes'));
app.use('/api/coupons', require('./routes/coupon.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/orders', require('./routes/order.routes'));

// Admin API — protected internally by requireAdmin on the router
app.use('/api/admin', require('./routes/admin.routes'));

// ---- 404 + error handling ----
app.use(notFound);
app.use(errorHandler);

// ---- Start ----
if (require.main === module) {
  const HOST = process.env.HOST || '0.0.0.0'; // Railway needs 0.0.0.0
  const server = app.listen(config.port, HOST, () => {
    console.log(`\n🌸 PE_ORIGINALS API running:`);
    console.log(`   http://localhost:${config.port}/api/health`);
    console.log(`   Frontend: http://localhost:${config.port}/`);
    console.log(`   Admin:    http://localhost:${config.port}/admin/\n`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] Port ${config.port} is already in use — Railway may have injected PORT. Retrying on PORT+1…`);
      const alt = app.listen(0, HOST, () => {
        console.log(`\n🌸 PE_ORIGINALS API running on ephemeral port ${alt.address().port}`);
      });
    } else {
      throw err;
    }
  });
}

module.exports = app;