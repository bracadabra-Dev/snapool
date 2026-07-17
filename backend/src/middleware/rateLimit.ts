import rateLimit from 'express-rate-limit';

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads from this IP, please try again shortly' },
});
