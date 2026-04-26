require('dotenv').config();
const os = require('os');

const required = ['MONGO_URI', 'REDIS_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing required env vars: ${missing.join(', ')}`);
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI,
  redisUrl: process.env.REDIS_URL,
  instanceId: process.env.INSTANCE_ID || os.hostname(),
  logToStdoutOnly: process.env.LOG_TO_STDOUT_ONLY === 'true',
  socketIoPath: process.env.SOCKET_IO_PATH || '/socket.io',
  trustProxy: process.env.TRUST_PROXY === 'true',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtl: process.env.REFRESH_TOKEN_TTL || '14d',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    publicUrl: process.env.PUBLIC_UPLOAD_URL || '/uploads',
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
    maxFiles: parseInt(process.env.MAX_FILES || '3', 10),
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  bcryptCost: parseInt(process.env.BCRYPT_COST || '10', 10),
  rateLimit: {
    global: parseInt(process.env.RATE_LIMIT_GLOBAL || '100', 10),
    login: parseInt(process.env.RATE_LIMIT_LOGIN || '10', 10),
  },
};
