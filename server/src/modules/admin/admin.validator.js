const { body } = require('express-validator');

const roleRules = [
  body('role').isIn(['user', 'popular', 'admin']).withMessage('Invalid role'),
];

const banRules = [
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('forceDelete').optional().isBoolean().withMessage('forceDelete must be boolean'),
];

module.exports = { roleRules, banRules };
