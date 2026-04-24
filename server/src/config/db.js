const mongoose = require('mongoose');
const { mongoUri } = require('./env');
const logger = require('./logger');

async function connectDB() {
  await mongoose.connect(mongoUri);
  logger.info(`MongoDB connected: ${mongoUri}`);

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
}

async function closeDB() {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}

module.exports = { connectDB, closeDB };
