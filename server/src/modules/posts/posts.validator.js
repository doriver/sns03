const { body, query, param } = require('express-validator');

const createRules = [
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 chars'),
  body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Content must be 1-5000 chars'),
];

const updateRules = [
  body('title').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 chars'),
  body('content').optional().trim().isLength({ min: 1, max: 5000 }).withMessage('Content must be 1-5000 chars'),
];

const listRules = [
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt().withMessage('limit must be 1-50'),
];

module.exports = { createRules, updateRules, listRules };
