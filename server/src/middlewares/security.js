const helmet = require('helmet');
const cors = require('cors');
const { corsOrigin } = require('../config/env');

function escapeHtml(val) {
  if (typeof val === 'string') {
    return val
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  if (val && typeof val === 'object') {
    for (const key of Object.keys(val)) val[key] = escapeHtml(val[key]);
  }
  return val;
}

function xssSanitize(req, res, next) {
  if (req.body) req.body = escapeHtml(req.body);
  next();
}

function noSqlGuard(req, res, next) {
  function strip(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$')) {
        delete obj[key];
      } else {
        strip(obj[key]);
      }
    }
  }
  strip(req.body);
  strip(req.query);
  next();
}

const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
});

const corsMiddleware = cors({
  origin: corsOrigin,
  credentials: true,
});

module.exports = { helmetMiddleware, corsMiddleware, xssSanitize, noSqlGuard };
