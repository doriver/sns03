const router = require('express').Router();
const ctrl = require('./chat.controller');
const { createRoomRules, roomIdRule, messageQueryRules } = require('./chat.validator');
const validate = require('../../middlewares/validate');
const { requireAuth, optionalAuth, requireRole, requireAuthSSE } = require('../../middlewares/auth');
const { chatWriteLimiter } = require('../../middlewares/rateLimit');

router.post('/chat/rooms', chatWriteLimiter, createRoomRules, validate, requireAuth, requireRole('popular', 'admin'), ctrl.createRoom);
router.get('/chat/rooms', optionalAuth, ctrl.listRooms);
router.get('/chat/rooms/stream', requireAuthSSE, ctrl.streamRoomList);
router.get('/chat/rooms/:id', roomIdRule, validate, optionalAuth, ctrl.getRoom);
router.post('/chat/rooms/:id/close', roomIdRule, validate, requireAuth, ctrl.closeRoom);
router.post('/chat/rooms/:id/join', chatWriteLimiter, roomIdRule, validate, requireAuth, ctrl.joinRoom);
router.post('/chat/rooms/:id/leave', roomIdRule, validate, requireAuth, ctrl.leaveRoom);
router.get('/chat/rooms/:id/messages', roomIdRule, messageQueryRules, validate, requireAuth, ctrl.getMessages);

module.exports = router;
