const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError('NOT_FOUND', 404, `${req.method} ${req.path} not found`));
}

module.exports = notFound;
