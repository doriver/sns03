const { body, query } = require('express-validator');

const createRules = [
  body('content').trim().isLength({ min: 1, max: 500 }).withMessage('Content must be 1-500 chars'),
];

const updateRules = [
  body('content').trim().isLength({ min: 1, max: 500 }).withMessage('Content must be 1-500 chars'),
];

const listRules = [
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('page must be positive integer'),
  query('size').optional().isInt({ min: 1, max: 50 }).toInt().withMessage('size must be 1-50'),
];

module.exports = { createRules, updateRules, listRules };
