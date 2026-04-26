const { body, param, query } = require('express-validator');

const createRoomRules = [
  body('name').trim().isLength({ min: 1, max: 30 }).withMessage('name must be 1-30 chars'),
  body('capacity').isInt({ min: 2, max: 50 }).toInt().withMessage('capacity must be integer 2-50'),
  body('description').optional().trim().isLength({ max: 200 }).withMessage('description max 200 chars'),
];

const roomIdRule = [
  param('id').isMongoId().withMessage('invalid room id'),
];

const messageQueryRules = [
  query('before').optional().isISO8601().withMessage('before must be ISO date'),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt().withMessage('limit must be 1-50'),
];

module.exports = { createRoomRules, roomIdRule, messageQueryRules };
