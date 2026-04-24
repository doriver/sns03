const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const sensitiveKeys = ['password', 'passwordHash', 'token', 'authorization', 'cookie'];

function maskSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      sensitiveKeys.some((s) => k.toLowerCase().includes(s)) ? [k, '***'] : [k, v]
    )
  );
}

const logsDir = path.join(__dirname, '../../logs');

const transports = [
  new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    level: 'info',
  }),
  new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    level: 'error',
  }),
];

if (process.env.NODE_ENV !== 'test') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format((info) => {
      if (info.meta) info.meta = maskSensitive(info.meta);
      return info;
    })(),
    winston.format.json()
  ),
  transports,
});

logger.stream = {
  write: (message) => logger.info(message.trim()),
};

module.exports = logger;
