const { ok } = require('../../utils/response');
const chatService = require('./chat.service');
const { subscribeRoomList } = require('./chat.realtime');

async function createRoom(req, res) {
  const room = await chatService.createRoom(req.user, {
    name: req.body.name,
    capacity: req.body.capacity,
    description: req.body.description,
  });
  return ok(res, { room }, 201);
}

async function listRooms(req, res) {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '20', 10);
  const sort = req.query.sort === 'participants' ? 'participants' : 'createdAt';
  const result = await chatService.listRooms({ page, limit, sort });
  return ok(res, result);
}

async function streamRoomList(req, res) {
  subscribeRoomList(req, res);
}

async function closeRoom(req, res) {
  await chatService.closeRoom(req.user, req.params.id);
  return ok(res, { message: '채팅방이 종료되었습니다' });
}

async function joinRoom(req, res) {
  const result = await chatService.joinRoom(req.user, req.params.id);
  return ok(res, result);
}

async function leaveRoom(req, res) {
  const result = await chatService.leaveRoom(req.user, req.params.id);
  return ok(res, result);
}

async function getMessages(req, res) {
  const { before, limit } = req.query;
  const messages = await chatService.getMessages(req.params.id, { before, limit });
  return ok(res, { messages });
}

async function getRoom(req, res) {
  const room = await chatService.getRoom(req.params.id);
  return ok(res, { room });
}

module.exports = { createRoom, listRooms, streamRoomList, closeRoom, joinRoom, leaveRoom, getMessages, getRoom };
