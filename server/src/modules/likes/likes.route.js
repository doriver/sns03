const router = require('express').Router();
const ctrl = require('./likes.controller');
const { requireAuth } = require('../../middlewares/auth');

router.post('/posts/:id/like', requireAuth, ctrl.toggle);

module.exports = router;
