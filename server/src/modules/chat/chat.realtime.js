const { WebSocketServer } = require('ws');
const { verifyAccessToken } = require('../auth/token.service');
const User = require('../../models/User');
const ChatParticipation = require('../../models/ChatParticipation');
const { getRedis } = require('../../config/redis');
const logger = require('../../config/logger');

// roomId(string) -> Set<WebSocket>
const wsRooms = new Map();

// SSE 목록 구독자
const sseListeners = new Set();

// 소켓별 rate limit: userId -> { count, resetAt }
const rateBuckets = new Map();

function getRoomSockets(roomId) {
  if (!wsRooms.has(roomId)) wsRooms.set(roomId, new Set());
  return wsRooms.get(roomId);
}

function broadcastRoom(roomId, eventType, data) {
  const sockets = wsRooms.get(roomId);
  if (!sockets) return;
  const msg = JSON.stringify({ type: eventType, data });
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function broadcastRoomList(eventType, data) {
  const msg = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseListeners) {
    try { res.write(msg); } catch { sseListeners.delete(res); }
  }
}

function subscribeRoomList(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
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
  const sockets = wsRooms.get(roomId);
  if (!sockets) return;
  const msg = JSON.stringify({ type: 'room:closed' });
  for (const ws of sockets) {
    try {
      if (ws.readyState === ws.OPEN) ws.send(msg);
      ws.close(1000, 'room closed');
    } catch { /* ignore */ }
  }
  wsRooms.delete(roomId);
}

function checkRateLimit(userId) {
  const now = Date.now();
  let bucket = rateBuckets.get(userId);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + 1000 };
    rateBuckets.set(userId, bucket);
  }
  bucket.count++;
  return bucket.count <= 3;
}

function attachWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    const match = url.pathname.match(/^\/ws\/chat\/([^/]+)$/);
    if (!match) { socket.destroy(); return; }

    const roomId = match[1];
    const token = url.searchParams.get('token');
    if (!token) { socket.destroy(); return; }

    let user;
    try {
      const payload = verifyAccessToken(token);
      user = await User.findById(payload.sub).lean();
      if (!user || user.deletedAt || user.bannedAt) throw new Error('invalid user');
    } catch {
      socket.destroy();
      return;
    }

    // 현재 참여 중(leftAt: null)인 row 확인
    const participation = await ChatParticipation.findOne({
      roomId,
      userId: user._id,
      leftAt: null,
    }).lean();

    if (!participation) { socket.destroy(); return; }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws._userId = String(user._id);
      ws._nickname = user.nickname;
      ws._profileImage = user.profileImage;
      ws._role = user.role;
      ws._roomId = roomId;

      getRoomSockets(roomId).add(ws);

      ws.on('message', async (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'message:send') {
          const content = String(msg.content || '').trim();
          if (!content || content.length > 500) return;

          if (!checkRateLimit(ws._userId)) {
            ws.send(JSON.stringify({ type: 'error', data: { code: 'RATE_LIMIT', message: 'Too fast' } }));
            return;
          }

          const redis = getRedis();
          const entry = JSON.stringify({
            authorId: ws._userId,
            nickname: ws._nickname,
            profileImage: ws._profileImage,
            role: ws._role,
            content,
            createdAt: new Date().toISOString(),
          });
          await redis.rpush(`chat:buf:${roomId}`, entry);

          broadcastRoom(roomId, 'message:new', {
            authorId: ws._userId,
            nickname: ws._nickname,
            profileImage: ws._profileImage,
            role: ws._role,
            content,
            createdAt: entry ? JSON.parse(entry).createdAt : new Date().toISOString(),
          });

        } else if (msg.type === 'leave') {
          // 명시적 leave — HTTP /leave와 동일한 효과를 service layer에서 처리하기 위해
          // 여기서는 WS만 정리하고 클라이언트가 HTTP /leave를 별도 호출하도록 설계
          ws.close(1000, 'leave');
        }
      });

      ws.on('close', () => {
        getRoomSockets(roomId).delete(ws);
        if (getRoomSockets(roomId).size === 0) wsRooms.delete(roomId);
      });

      ws.on('error', (err) => logger.error('WS error', { err: err.message }));
    });
  });
}

module.exports = { attachWebSocket, broadcastRoom, broadcastRoomList, subscribeRoomList, forceCloseRoom };
