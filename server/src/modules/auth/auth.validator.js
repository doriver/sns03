const { body } = require('express-validator');

const signupRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8, max: 64 })
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('Password must be 8-64 chars with letters and numbers'),
  body('nickname')
    .trim()
    .isLength({ min: 2, max: 20 })
    .matches(/^\S+$/)
    .withMessage('Nickname must be 2-20 chars with no spaces'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

module.exports = { signupRules, loginRules };
