const { ok } = require('../../utils/response');
const followsService = require('./follows.service');

async function follow(req, res) {
  const result = await followsService.follow(req.user._id, req.params.id);
  return ok(res, result);
}

async function unfollow(req, res) {
  const result = await followsService.unfollow(req.user._id, req.params.id);
  return ok(res, result);
}

async function followers(req, res) {
  const { page, size } = req.query;
  const result = await followsService.listFollowers(req.params.id, {
    page: page ? parseInt(page) : 1,
    size: size ? parseInt(size) : 20,
  });
  return ok(res, result);
}

async function following(req, res) {
  const { page, size } = req.query;
  const result = await followsService.listFollowing(req.params.id, {
    page: page ? parseInt(page) : 1,
    size: size ? parseInt(size) : 20,
  });
  return ok(res, result);
}

module.exports = { follow, unfollow, followers, following };
