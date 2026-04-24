const { body } = require('express-validator');

const updateRules = [
  body('nickname')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .matches(/^\S+$/)
    .withMessage('Nickname must be 2-20 chars with no spaces'),
];

module.exports = { updateRules };
