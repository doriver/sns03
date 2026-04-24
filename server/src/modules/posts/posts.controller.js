const { ok } = require('../../utils/response');
const postsService = require('./posts.service');

async function list(req, res) {
  const { cursor, limit, authorId, page } = req.query;
  const parsedLimit = limit || 20;
  if (page) {
    const result = await postsService.listByPage({ page, limit: parsedLimit, authorId });
    return ok(res, result);
  }
  const result = await postsService.listByCursor({ cursor, limit: parsedLimit, authorId });
  return ok(res, result);
}

async function getOne(req, res) {
  const viewKey = req.user ? String(req.user._id) : req.ip;
  const post = await postsService.getById(req.params.id, viewKey);
  return ok(res, { post });
}

async function create(req, res) {
  const post = await postsService.create({
    authorId: req.user._id,
    title: req.body.title,
    content: req.body.content,
    files: req.files,
  });
  return ok(res, { post }, 201);
}

async function update(req, res) {
  const removeImages = req.body.removeImages
    ? (Array.isArray(req.body.removeImages) ? req.body.removeImages : [req.body.removeImages])
    : [];
  const post = await postsService.update(req.params.id, req.user._id, req.user.role, {
    title: req.body.title,
    content: req.body.content,
    files: req.files,
    removeImages,
  });
  return ok(res, { post });
}

async function remove(req, res) {
  await postsService.softDelete(req.params.id, req.user._id, req.user.role);
  return ok(res, { message: 'Post deleted' });
}

module.exports = { list, getOne, create, update, remove };
