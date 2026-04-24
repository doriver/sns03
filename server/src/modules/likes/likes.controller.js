const { ok } = require('../../utils/response');
const likesService = require('./likes.service');

async function toggle(req, res) {
  const result = await likesService.toggle(req.params.id, req.user._id);
  return ok(res, result);
}

module.exports = { toggle };
