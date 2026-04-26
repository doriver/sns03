require('express-async-errors');
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const { helmetMiddleware, corsMiddleware, xssSanitize, noSqlGuard } = require('./middlewares/security');
const { globalLimiter } = require('./middlewares/rateLimit');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const logger = require('./config/logger');
const { upload: uploadConfig } = require('./config/env');

const app = express();

app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(morgan('combined', { stream: logger.stream }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(noSqlGuard);
app.use(xssSanitize);
app.use(globalLimiter);

app.use(uploadConfig.publicUrl, express.static(path.resolve(uploadConfig.dir)));
app.use(express.static(path.join(__dirname, '../../client')));

app.get('/health', async (req, res) => {
  const { pingRedis } = require('./config/redis');
  const mongoose = require('mongoose');
  const redisOk = await pingRedis().then(() => true).catch(() => false);
  const mongoOk = mongoose.connection.readyState === 1;
  res.status(200).json({ ok: true, data: { mongo: mongoOk, redis: redisOk } });
});

app.use('/api', require('./modules/auth/auth.route'));
app.use('/api', require('./modules/users/users.route'));
app.use('/api', require('./modules/posts/posts.route'));
app.use('/api', require('./modules/comments/comments.route'));
app.use('/api', require('./modules/likes/likes.route'));
app.use('/api', require('./modules/follows/follows.route'));
app.use('/api', require('./modules/admin/admin.route'));
app.use('/api', require('./modules/chat/chat.route'));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return;
  res.sendFile(path.join(__dirname, '../../client/index.html'));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
