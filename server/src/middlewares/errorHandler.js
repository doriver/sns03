const AppError = require('../utils/AppError');
const { fail } = require('../utils/response');
const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return fail(res, err.code, err.message, err.status, err.details);
  }

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, details);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return fail(res, 'USER_DUPLICATE', `${field} already exists`, 409);
  }

  if (err.name === 'JsonWebTokenError') {
    return fail(res, 'AUTH_TOKEN_INVALID', 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return fail(res, 'AUTH_TOKEN_EXPIRED', 'Token expired', 401);
  }

  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') {
    return fail(res, 'FILE_TOO_LARGE', 'File size exceeds limit', 413);
  }

  logger.error('Unhandled error', { err: err.message, stack: err.stack, path: req.path });
  return fail(res, 'INTERNAL_ERROR', 'Internal server error', 500);
}

module.exports = errorHandler;
