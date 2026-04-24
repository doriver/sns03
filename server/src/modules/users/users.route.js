const router = require('express').Router();
const ctrl = require('./users.controller');
const { updateRules } = require('./users.validator');
const validate = require('../../middlewares/validate');
const { requireAuth, optionalAuth } = require('../../middlewares/auth');
const { uploadProfile } = require('../../middlewares/upload');

router.get('/users/me', requireAuth, ctrl.getMe);
router.patch('/users/me', requireAuth, uploadProfile.single('profileImage'), updateRules, validate, ctrl.updateMe);
router.delete('/users/me', requireAuth, ctrl.deleteMe);
router.get('/users/:id', optionalAuth, ctrl.getProfile);

module.exports = router;
