const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { verifyAccessToken } = require('../auth/token.service');
const User = require('../../models/User');
const ChatParticipation = require('../../models/ChatParticipation');
const { getRedis } = require('../../config/redis');
const { socketIoPath, corsOrigin } = require('../../config/env');
const logger = require('../../config/logger');

const SSE_CHANNEL = 'sse:room-list';

// 이 인스턴스에 연결된 SSE 클라이언트
const sseListeners = new Set();

let io;

async function checkChatRateLimit(userId) {
  const sec = Math.floor(Date.now() / 1000);
  const key = `chat:rl:${userId}:${sec}`;
  const r = getRedis();
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, 1);
  return count <= 3;
}

function initSsePubSub() {
  const sseSub = getRedis().duplicate();
  sseSub.subscribe(SSE_CHANNEL);
  sseSub.on('message', (_ch, raw) => {
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return; }
    const { type, data } = parsed;
    const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseListeners) {
      try { res.write(msg); } catch { sseListeners.delete(res); }
    }
  });
}

function attachWebSocket(server) {
  io = new Server(server, {
    path: socketIoPath,
    cors: { origin: corsOrigin, credentials: true },
    transports: ['websocket'],
  });

  const pub = getRedis().duplicate();
  const sub = getRedis().duplicate();
  io.adapter(createAdapter(pub, sub)); // Redis pub/sub으로 WAS 간 동기화

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('UNAUTHORIZED'));
    try {
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).lean();
      if (!user || user.deletedAt || user.bannedAt) throw new Error('invalid user');
      socket.data.user = user;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    socket.on('room:join', async ({ roomId } = {}, cb) => {
      if (!roomId) return cb?.({ ok: false });
      try {
        const participation = await ChatParticipation.findOne({
          roomId,
          userId: user._id,
          leftAt: null,
        }).lean();
        if (!participation) return cb?.({ ok: false, error: 'NOT_JOINED' });
        socket.join('room:' + roomId); // (socket.io의 room 개념) 명명한 room에 소켓 등록, 이때 어댑터가 내부적으로 Redis의 socket.io#{namespace}#{room이름} 채널을 subscribe 함
        cb?.({ ok: true });
      } catch (err) {
        logger.error('room:join error', { err: err.message });
        cb?.({ ok: false });
      }
    });

    socket.on('room:leave', ({ roomId } = {}) => {
      if (roomId) socket.leave('room:' + roomId);
    });

    socket.on('message:send', async ({ roomId, content } = {}, cb) => {
      if (!roomId || !content) return cb?.({ ok: false });
      const text = String(content).trim();
      if (!text || text.length > 500) return cb?.({ ok: false });

      try {
        const allowed = await checkChatRateLimit(String(user._id));
        if (!allowed) {
          socket.emit('error', { code: 'RATE_LIMIT', message: 'Too fast' });
          return cb?.({ ok: false });
        }

        const entry = {
          authorId: String(user._id),
          nickname: user.nickname,
          profileImage: user.profileImage || null,
          role: user.role,
          content: text,
          createdAt: new Date().toISOString(),
        };
        // Redis 리스트에 버퍼링
        await getRedis().rpush(`chat:buf:${roomId}`, JSON.stringify(entry));
        // 방에 있는 모든 클라이언트에게 브로드캐스트 
        io.to('room:' + roomId).emit('message:new', entry); // redis-adapter로 redis pub/sub 됨
        cb?.({ ok: true });
      } catch (err) {
        logger.error('message:send error', { err: err.message });
        cb?.({ ok: false });
      }
    });

    socket.on('error', (err) => logger.error('socket error', { err: err.message }));
  });

  initSsePubSub();
}

function broadcastRoom(roomId, eventType, data) {
  if (!io) return;
  io.to('room:' + roomId).emit(eventType, data);
}

function broadcastRoomList(eventType, data) {
  getRedis().publish(SSE_CHANNEL, JSON.stringify({ type: eventType, data }));
}

function subscribeRoomList(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(': connected\n\n');

  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  sseListeners.add(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseListeners.delete(res);
  });
}

function forceCloseRoom(roomId) {
  if (!io) return;
  io.to('room:' + roomId).emit('room:closed');
  io.in('room:' + roomId).disconnectSockets(true);
}

module.exports = { attachWebSocket, broadcastRoom, broadcastRoomList, subscribeRoomList, forceCloseRoom };
