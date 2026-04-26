const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('../config/redis');
const { rateLimit: rlConfig } = require('../config/env');

function makeLimiter(max, windowMs = 60 * 1000) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => getRedis().call(...args),
    }),
    handler: (req, res) => {
      res.status(429).json({
        ok: false,
        error: { code: 'RATE_TOO_MANY', message: 'Too many requests, please try again later.' },
      });
    },
  });
}

const globalLimiter = makeLimiter(rlConfig.global);
const loginLimiter = makeLimiter(rlConfig.login);
const chatWriteLimiter = makeLimiter(30);

module.exports = { globalLimiter, loginLimiter, chatWriteLimiter };
