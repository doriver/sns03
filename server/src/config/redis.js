const Redis = require('ioredis');
const { redisUrl } = require('./env');
const logger = require('./logger');

let client;

function getRedis() {
  if (!client) {
    client = new Redis(redisUrl, { lazyConnect: true });

    client.on('connect', () => logger.info('Redis connected'));
    client.on('error', (err) => logger.error('Redis error', { err: err.message }));
  }
  return client;
}

async function connectRedis() {
  await getRedis().connect();
}

async function closeRedis() {
  if (client) {
    await client.quit();
    client = null;
    logger.info('Redis connection closed');
  }
}

async function pingRedis() {
  return getRedis().ping();
}

module.exports = { getRedis, connectRedis, closeRedis, pingRedis };
