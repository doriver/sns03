const User = require('../../models/User');
const AppError = require('../../utils/AppError');
const { signAccessToken, issueRefreshToken } = require('./token.service');
const { ttlToSeconds } = require('./token.service');
const { jwt: jwtConfig } = require('../../config/env');

async function signup({ email, password, nickname }) {
  const existing = await User.findOne({ $or: [{ email }, { nickname }] });
  if (existing) {
    const field = existing.email === email ? 'email' : 'nickname';
    throw new AppError('USER_DUPLICATE', 409, `${field} already exists`);
  }

  const user = new User({ email, passwordHash: password, nickname });
  await user.save();
  return user;
}

async function login({ email, password, ua, ip }) {
  const user = await User.findOne({ email });
  if (!user || user.deletedAt) throw new AppError('AUTH_INVALID', 401, 'Invalid credentials');
  if (user.bannedAt) throw new AppError('AUTH_BANNED', 403, 'Account suspended');

  const valid = await user.comparePassword(password);
  if (!valid) throw new AppError('AUTH_INVALID', 401, 'Invalid credentials');

  const accessToken = signAccessToken({ sub: user._id });
  const { token: refreshToken, ttlSeconds } = await issueRefreshToken(String(user._id), ua, ip);

  return { user, accessToken, refreshToken, ttlSeconds };
}

module.exports = { signup, login };
