const rateLimit = require('express-rate-limit');

// Rate limiter for student endpoints (30 requests per minute per IP)
const studentRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for subject fetch requests (5 requests per 10 seconds per user)
const subjectFetchLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 5,
  message: { 
    error: 'Too many subject fetch requests. You have been temporarily blocked.',
    code: 'RATE_LIMIT_SUBJECT'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,

});

// Rate limiter for admin endpoints (10 requests per second per user)
const adminRateLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 10,
  message: { error: 'Too many admin requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
});

// Login brute-force himoyasi — IP bo'yicha 10 urinish / 15 daqiqa
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 10,
  message: { error: 'Juda ko\'p login urinish. 15 daqiqadan so\'ng qayta urinib ko\'ring.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Muvaffaqiyatli loginlarni hisoblamaymiz
});

// General API rate limiter
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3000, // Shared school NAT; authentication still protects individual endpoints.
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  studentRateLimiter,
  subjectFetchLimiter,
  adminRateLimiter,
  loginRateLimiter,
  apiRateLimiter
};
