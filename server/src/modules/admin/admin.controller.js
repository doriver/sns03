const { ok } = require('../../utils/response');
const adminService = require('./admin.service');

async function listUsers(req, res) {
  const { search, role, page, size, sort } = req.query;
  const result = await adminService.listUsers({
    search,
    role,
    page: page ? parseInt(page) : 1,
    size: size ? parseInt(size) : 20,
    sort: sort || '-createdAt',
  });
  return ok(res, result);
}

async function changeRole(req, res) {
  const { role, reason } = req.body;
  const user = await adminService.changeRole(req.user._id, req.params.id, role, reason);
  return ok(res, { user });
}

async function banUser(req, res) {
  const { reason, forceDelete } = req.body;
  const user = await adminService.banUser(req.user._id, req.params.id, reason, !!forceDelete);
  return ok(res, { user });
}

async function togglePostHidden(req, res) {
  const post = await adminService.togglePostHidden(req.user._id, req.params.id);
  return ok(res, { post });
}

async function deletePost(req, res) {
  await adminService.deletePost(req.user._id, req.params.id);
  return ok(res, { message: 'Post deleted' });
}

async function deleteComment(req, res) {
  await adminService.deleteComment(req.user._id, req.params.id);
  return ok(res, { message: 'Comment deleted' });
}

async function getStats(req, res) {
  const stats = await adminService.getStats();
  return ok(res, { stats });
}

module.exports = { listUsers, changeRole, banUser, togglePostHidden, deletePost, deleteComment, getStats };
