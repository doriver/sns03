const router = require('express').Router();
const ctrl = require('./posts.controller');
const { createRules, updateRules, listRules } = require('./posts.validator');
const validate = require('../../middlewares/validate');
const { requireAuth, optionalAuth } = require('../../middlewares/auth');
const { uploadPost } = require('../../middlewares/upload');

router.get('/posts', listRules, validate, optionalAuth, ctrl.list);
router.get('/posts/timeline', require('../timeline/timeline.controller').getTimeline);
router.get('/posts/:id', optionalAuth, ctrl.getOne);
router.post('/posts', requireAuth, uploadPost.array('images', 3), createRules, validate, ctrl.create);
router.patch('/posts/:id', requireAuth, uploadPost.array('images', 3), updateRules, validate, ctrl.update);
router.delete('/posts/:id', requireAuth, ctrl.remove);

module.exports = router;
