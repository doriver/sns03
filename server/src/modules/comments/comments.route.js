const router = require('express').Router();
const ctrl = require('./comments.controller');
const { createRules, updateRules, listRules } = require('./comments.validator');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth');

router.get('/posts/:postId/comments', listRules, validate, ctrl.list);
router.post('/posts/:postId/comments', requireAuth, createRules, validate, ctrl.create);
router.patch('/comments/:id', requireAuth, updateRules, validate, ctrl.update);
router.delete('/comments/:id', requireAuth, ctrl.remove);

module.exports = router;
