// ============================================================
// middleware/validate.js — Zod schema validation for request
// bodies/params/query. Rejects with 400 before hitting handlers.
// ============================================================
const { ZodError } = require('zod');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed; // replace with sanitised/coerced data
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
      }
      return next(err);
    }
  };
}

module.exports = { validate };
