const router = require('express').Router();
const ctrl = require('./auth.controller');
const { signupRules, loginRules } = require('./auth.validator');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth');
const { loginLimiter } = require('../../middlewares/rateLimit');

router.post('/auth/signup', signupRules, validate, ctrl.signup);
router.post('/auth/login', loginLimiter, loginRules, validate, ctrl.login);
router.post('/auth/refresh', ctrl.refresh);
router.post('/auth/logout', ctrl.logout);
router.post('/auth/logout-all', requireAuth, ctrl.logoutAll);

module.exports = router;
