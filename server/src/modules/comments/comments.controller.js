const { ok } = require('../../utils/response');
const commentsService = require('./comments.service');

async function list(req, res) {
  const { page, size } = req.query;
  const result = await commentsService.list(req.params.postId, {
    page: page ? parseInt(page) : 1,
    size: size ? parseInt(size) : 20,
  });
  return ok(res, result);
}

async function create(req, res) {
  const comment = await commentsService.create(req.params.postId, req.user._id, req.body.content);
  return ok(res, { comment }, 201);
}

async function update(req, res) {
  const comment = await commentsService.update(req.params.id, req.user._id, req.user.role, req.body.content);
  return ok(res, { comment });
}

async function remove(req, res) {
  await commentsService.softDelete(req.params.id, req.user._id, req.user.role);
  return ok(res, { message: 'Comment deleted' });
}

module.exports = { list, create, update, remove };
