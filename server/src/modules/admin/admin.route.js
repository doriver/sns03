const router = require('express').Router();
const ctrl = require('./admin.controller');
const { roleRules, banRules } = require('./admin.validator');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');

const adminGuard = [requireAuth, requireRole('admin')];

router.get('/admin/users', ...adminGuard, ctrl.listUsers);
router.patch('/admin/users/:id/role', ...adminGuard, roleRules, validate, ctrl.changeRole);
router.post('/admin/users/:id/ban', ...adminGuard, banRules, validate, ctrl.banUser);
router.patch('/admin/posts/:id/hidden', ...adminGuard, ctrl.togglePostHidden);
router.delete('/admin/posts/:id', ...adminGuard, ctrl.deletePost);
router.delete('/admin/comments/:id', ...adminGuard, ctrl.deleteComment);
router.get('/admin/stats', ...adminGuard, ctrl.getStats);

module.exports = router;
