const ChatRoom = require('../../models/ChatRoom');
const ChatMessage = require('../../models/ChatMessage');
const ChatParticipation = require('../../models/ChatParticipation');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');
const { getRedis } = require('../../config/redis');
const { broadcastRoomList, broadcastRoom, forceCloseRoom } = require('./chat.realtime');

async function flushBufferToMongo(roomId) {
  const redis = getRedis();
  const key = `chat:buf:${roomId}`;
  const items = await redis.lrange(key, 0, -1);
  if (items.length) {
    const docs = items.map((raw) => {
      const d = JSON.parse(raw);
      return {
        roomId,
        authorId: d.authorId,
        content: d.content,
        createdAt: new Date(d.createdAt),
      };
    });
    await ChatMessage.insertMany(docs, { ordered: false });
  }
  await redis.del(key);
  return items.length;
}

async function cleanRoomRedisKeys(roomId) {
  const redis = getRedis();
  await Promise.all([
    redis.del(`chat:room:${roomId}:count`),
    redis.del(`chat:room:${roomId}:members`),
  ]);
}

async function createRoom(user, { name, capacity, description = '' }) {
  if (!['popular', 'admin'].includes(user.role)) {
    throw new AppError('CHAT_FORBIDDEN', 403, '방 생성 권한이 없습니다');
  }

  const existing = await ChatRoom.findOne({ ownerId: user._id, closedAt: null }).lean();
  if (existing) {
    throw new AppError('CHAT_ROOM_ALREADY_EXISTS', 409, '이미 활성 채팅방이 있습니다');
  }

  const room = await ChatRoom.create({
    name,
    description,
    ownerId: user._id,
    capacity,
    participantCount: 0,
  });

  const redis = getRedis();
  await redis.set(`chat:room:${room._id}:count`, 0);

  const populated = await ChatRoom.findById(room._id)
    .populate('ownerId', 'nickname profileImage role')
    .lean();

  broadcastRoomList('room:created', formatRoom(populated));
  return formatRoom(populated);
}

async function listRooms({ page = 1, limit = 20, sort = 'createdAt' } = {}) {
  const skip = (page - 1) * limit;
  const sortObj = sort === 'participants' ? { participantCount: -1 } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    ChatRoom.find({ closedAt: null })
      .populate('ownerId', 'nickname profileImage role')
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean(),
    ChatRoom.countDocuments({ closedAt: null }),
  ]);

  return {
    items: items.map(formatRoom),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

async function closeRoom(user, roomId) {
  const room = await ChatRoom.findById(roomId);
  if (!room) throw new AppError('CHAT_ROOM_NOT_FOUND', 404, '채팅방을 찾을 수 없습니다');
  if (room.closedAt) throw new AppError('CHAT_ROOM_CLOSED', 409, '이미 종료된 채팅방입니다');

  const isOwner = String(room.ownerId) === String(user._id);
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new AppError('CHAT_FORBIDDEN', 403, '방 종료 권한이 없습니다');
  }

  const now = new Date();
  room.closedAt = now;
  room.closedBy = user._id;
  await room.save();

  // 참석 중인 모든 row의 leftAt 채우기
  await ChatParticipation.updateMany(
    { roomId, leftAt: null },
    { $set: { leftAt: now } }
  );

  // 메시지 flush
  await flushBufferToMongo(String(roomId));
  await cleanRoomRedisKeys(String(roomId));

  // WS 강제 종료 + SSE 브로드캐스트
  forceCloseRoom(String(roomId));
  broadcastRoomList('room:closed', { roomId: String(roomId) });
}

async function joinRoom(user, roomId) {
  const room = await ChatRoom.findById(roomId).lean();
  if (!room) throw new AppError('CHAT_ROOM_NOT_FOUND', 404, '채팅방을 찾을 수 없습니다');
  if (room.closedAt) throw new AppError('CHAT_ROOM_CLOSED', 409, '종료된 채팅방입니다');

  const redis = getRedis();
  const countKey = `chat:room:${roomId}:count`;
  const membersKey = `chat:room:${roomId}:members`;

  // 이미 참여 중인지 확인
  const alreadyMember = await redis.sismember(membersKey, String(user._id));
  if (alreadyMember) {
    return { roomId: String(roomId), alreadyJoined: true };
  }

  // 원자적 capacity 검사
  const newCount = await redis.incr(countKey);
  if (newCount > room.capacity) {
    await redis.decr(countKey);
    throw new AppError('CHAT_ROOM_FULL', 409, '채팅방이 꽉 찼습니다');
  }

  await redis.sadd(membersKey, String(user._id));

  const now = new Date();
  await ChatParticipation.create({ roomId, userId: user._id, joinedAt: now });
  await ChatRoom.findByIdAndUpdate(roomId, { $set: { participantCount: newCount } });

  broadcastRoomList('room:participant-changed', { roomId: String(roomId), count: newCount });
  broadcastRoom(String(roomId), 'presence:update', { roomId: String(roomId), count: newCount });

  return { roomId: String(roomId), participantCount: newCount };
}

async function leaveRoom(user, roomId) {
  const room = await ChatRoom.findById(roomId).lean();
  if (!room) throw new AppError('CHAT_ROOM_NOT_FOUND', 404, '채팅방을 찾을 수 없습니다');
  if (room.closedAt) throw new AppError('CHAT_ROOM_CLOSED', 409, '이미 종료된 채팅방입니다');

  const redis = getRedis();
  const countKey = `chat:room:${roomId}:count`;
  const membersKey = `chat:room:${roomId}:members`;

  const isMember = await redis.sismember(membersKey, String(user._id));
  if (!isMember) throw new AppError('CHAT_NOT_JOINED', 409, '참여 중이 아닙니다');

  // 방장 퇴장 → 즉시 방 종료
  if (String(room.ownerId) === String(user._id)) {
    await closeRoom(user, roomId);
    return { closed: true };
  }

  await redis.srem(membersKey, String(user._id));
  const newCount = await redis.decr(countKey);
  const safeCount = Math.max(0, newCount);

  const now = new Date();
  await ChatParticipation.findOneAndUpdate(
    { roomId, userId: user._id, leftAt: null },
    { $set: { leftAt: now } },
    { sort: { joinedAt: -1 } }
  );
  await ChatRoom.findByIdAndUpdate(roomId, { $set: { participantCount: safeCount } });

  broadcastRoomList('room:participant-changed', { roomId: String(roomId), count: safeCount });
  broadcastRoom(String(roomId), 'presence:update', { roomId: String(roomId), count: safeCount });

  return { closed: false, participantCount: safeCount };
}

async function getMessages(roomId, { before, limit = 30 } = {}) {
  const room = await ChatRoom.findById(roomId).lean();
  if (!room) throw new AppError('CHAT_ROOM_NOT_FOUND', 404, '채팅방을 찾을 수 없습니다');

  if (!room.closedAt) {
    // 진행 중 방: Redis 버퍼에서 최근 50개
    const redis = getRedis();
    const items = await redis.lrange(`chat:buf:${roomId}`, -50, -1);
    return items.map((raw) => {
      const d = JSON.parse(raw);
      return { authorId: d.authorId, nickname: d.nickname, profileImage: d.profileImage, content: d.content, createdAt: d.createdAt };
    });
  }

  // 종료된 방: MongoDB 페이지네이션
  const filter = { roomId };
  if (before) filter.createdAt = { $lt: new Date(before) };

  const messages = await ChatMessage.find(filter)
    .populate('authorId', 'nickname profileImage role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return messages.reverse().map((m) => ({
    id: m._id,
    author: m.authorId,
    content: m.content,
    createdAt: m.createdAt,
  }));
}

async function getRoom(roomId) {
  const room = await ChatRoom.findById(roomId)
    .populate('ownerId', 'nickname profileImage role')
    .lean();
  if (!room) throw new AppError('CHAT_ROOM_NOT_FOUND', 404, '채팅방을 찾을 수 없습니다');
  return formatRoom(room);
}

function formatRoom(room) {
  return {
    id: room._id,
    name: room.name,
    description: room.description,
    owner: room.ownerId,
    capacity: room.capacity,
    participantCount: room.participantCount,
    closedAt: room.closedAt,
    createdAt: room.createdAt,
  };
}

module.exports = { createRoom, listRooms, closeRoom, joinRoom, leaveRoom, getMessages, getRoom, flushBufferToMongo };
