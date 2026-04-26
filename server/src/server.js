const http = require('http');
const app = require('./app');
const { connectDB, closeDB } = require('./config/db');
const { connectRedis, closeRedis } = require('./config/redis');
const { port } = require('./config/env');
const logger = require('./config/logger');
const { attachWebSocket } = require('./modules/chat/chat.realtime');

async function start() {
  await connectDB();
  await connectRedis();

  const server = http.createServer(app);
  attachWebSocket(server);

  server.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
  });

  async function shutdown(signal) {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await closeDB();
      await closeRedis();
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
