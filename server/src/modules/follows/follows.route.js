const router = require('express').Router();
const ctrl = require('./follows.controller');
const { requireAuth } = require('../../middlewares/auth');

router.post('/users/:id/follow', requireAuth, ctrl.follow);
router.delete('/users/:id/follow', requireAuth, ctrl.unfollow);
router.get('/users/:id/followers', ctrl.followers);
router.get('/users/:id/following', ctrl.following);

module.exports = router;
