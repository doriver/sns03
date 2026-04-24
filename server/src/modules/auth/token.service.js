const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { jwt: jwtConfig } = require('../../config/env');
const { getRedis } = require('../../config/redis');

const REFRESH_PREFIX = 'refresh';

function ttlToSeconds(ttl) {
  const match = String(ttl).match(/^(\d+)([smhd])$/);
  if (!match) return 60;
  const [, n, unit] = match;
  const map = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(n, 10) * map[unit];
}

function signAccessToken(payload) {
  return jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: jwtConfig.accessTtl });
}

function verifyAccessToken(token) {
  return jwt.verify(token, jwtConfig.accessSecret);
}

async function issueRefreshToken(userId, ua, ip) {
  const jti = uuidv4();
  const token = jwt.sign({ sub: userId, jti }, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshTtl,
  });
  const ttl = ttlToSeconds(jwtConfig.refreshTtl);
  const redis = getRedis();
  await redis.set(
    `${REFRESH_PREFIX}:${userId}:${jti}`,
    JSON.stringify({ token, ua, ip }),
    'EX',
    ttl
  );
  return { token, jti, ttlSeconds: ttl };
}

async function rotateRefreshToken(oldToken, ua, ip) {
  const payload = jwt.verify(oldToken, jwtConfig.refreshSecret);
  const { sub: userId, jti } = payload;
  const redis = getRedis();
  const key = `${REFRESH_PREFIX}:${userId}:${jti}`;
  const stored = await redis.getdel(key);
  if (!stored) throw Object.assign(new Error('Refresh token not found or already used'), { name: 'JsonWebTokenError' });

  const at = signAccessToken({ sub: userId });
  const rt = await issueRefreshToken(userId, ua, ip);
  return { accessToken: at, refreshToken: rt.token, ttlSeconds: rt.ttlSeconds, userId };
}

async function revokeRefreshToken(userId, jti) {
  const redis = getRedis();
  await redis.del(`${REFRESH_PREFIX}:${userId}:${jti}`);
}

async function revokeAllRefreshTokens(userId) {
  const redis = getRedis();
  const keys = await redis.keys(`${REFRESH_PREFIX}:${userId}:*`);
  if (keys.length) await redis.del(...keys);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  ttlToSeconds,
};
