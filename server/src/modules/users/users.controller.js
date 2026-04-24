const { ok } = require('../../utils/response');
const usersService = require('./users.service');
const tokenService = require('../auth/token.service');

async function getMe(req, res) {
  const user = await usersService.getMe(req.user._id);
  const User = require('../../models/User');
  const u = new User(user);
  return ok(res, { user: u.toPrivateJSON() });
}

async function updateMe(req, res) {
  const user = await usersService.updateMe(req.user._id, {
    nickname: req.body.nickname,
    file: req.file,
  });
  return ok(res, { user: user.toPrivateJSON() });
}

async function deleteMe(req, res) {
  await usersService.deleteMe(req.user._id);
  await tokenService.revokeAllRefreshTokens(String(req.user._id));
  res.clearCookie('refreshToken', { path: '/api/auth' });
  return ok(res, { message: 'Account deleted' });
}

async function getProfile(req, res) {
  const user = await usersService.getPublicProfile(req.params.id);
  const User = require('../../models/User');
  const u = new User(user);
  return ok(res, { user: u.toPublicJSON() });
}

module.exports = { getMe, updateMe, deleteMe, getProfile };
