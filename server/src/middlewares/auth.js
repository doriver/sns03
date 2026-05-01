const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../modules/auth/token.service');
const User = require('../models/User');
const { getRedis } = require('../config/redis');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError('AUTH_NO_TOKEN', 401, 'Authentication required'));

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).lean();
  if (!user || user.deletedAt || user.bannedAt) {
    return next(new AppError('AUTH_USER_INVALID', 401, 'User not available'));
  }

  req.user = user;

  // DAU(일간 활성 사용자) 기록
  const redis = getRedis();
  const today = new Date().toISOString().slice(0, 10);
  redis.sadd(`dau:${today}`, String(user._id)).catch(() => {});
  redis.expire(`dau:${today}`, 2 * 24 * 3600).catch(() => {});

  next();
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).lean();
    if (user && !user.deletedAt && !user.bannedAt) req.user = user;
  } catch {
    // ignore
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('AUTH_NO_TOKEN', 401, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('AUTH_FORBIDDEN', 403, 'Insufficient permission'));
    }
    next();
  };
}

// EventSource는 헤더를 설정할 수 없으므로 SSE 엔드포인트에서 ?token= 쿼리 파라미터도 허용
async function requireAuthSSE(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
  if (!token) return next(new AppError('AUTH_NO_TOKEN', 401, 'Authentication required'));

  let payload;
  try { payload = verifyAccessToken(token); } catch (e) { return next(e); }

  const user = await User.findById(payload.sub).lean();
  if (!user || user.deletedAt || user.bannedAt) {
    return next(new AppError('AUTH_USER_INVALID', 401, 'User not available'));
  }

  req.user = user;

  const redis = getRedis();
  const today = new Date().toISOString().slice(0, 10);
  redis.sadd(`dau:${today}`, String(user._id)).catch(() => {});
  redis.expire(`dau:${today}`, 2 * 24 * 3600).catch(() => {});

  next();
}

module.exports = { requireAuth, optionalAuth, requireRole, requireAuthSSE };
