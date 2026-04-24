const { ok } = require('../../utils/response');
const authService = require('./auth.service');
const tokenService = require('./token.service');

const COOKIE_NAME = 'refreshToken';

function setRtCookie(res, token, ttlSeconds) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ttlSeconds * 1000,
    path: '/api/auth',
  });
}

function clearRtCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
}

async function signup(req, res) {
  const user = await authService.signup(req.body);
  return ok(res, { user: user.toPrivateJSON() }, 201);
}

async function login(req, res) {
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip;
  const { user, accessToken, refreshToken, ttlSeconds } = await authService.login({ ...req.body, ua, ip });
  setRtCookie(res, refreshToken, ttlSeconds);
  return ok(res, { accessToken, user: user.toPrivateJSON() });
}

async function refresh(req, res) {
  const oldToken = req.cookies[COOKIE_NAME];
  if (!oldToken) {
    const AppError = require('../../utils/AppError');
    throw new AppError('AUTH_NO_TOKEN', 401, 'Refresh token missing');
  }
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip;
  const { accessToken, refreshToken, ttlSeconds } = await tokenService.rotateRefreshToken(oldToken, ua, ip);
  setRtCookie(res, refreshToken, ttlSeconds);
  return ok(res, { accessToken });
}

async function logout(req, res) {
  const oldToken = req.cookies[COOKIE_NAME];
  if (oldToken) {
    try {
      const jwt = require('jsonwebtoken');
      const { jwt: jwtConfig } = require('../../config/env');
      const { sub, jti } = jwt.verify(oldToken, jwtConfig.refreshSecret);
      await tokenService.revokeRefreshToken(sub, jti);
    } catch {
      // ignore invalid token on logout
    }
  }
  clearRtCookie(res);
  return ok(res, { message: 'Logged out' });
}

async function logoutAll(req, res) {
  await tokenService.revokeAllRefreshTokens(String(req.user._id));
  clearRtCookie(res);
  return ok(res, { message: 'Logged out from all devices' });
}

module.exports = { signup, login, refresh, logout, logoutAll };
