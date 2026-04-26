import { get, post } from './http.js';

export const getRooms = (params) => get('/api/chat/rooms', params);
export const getRoom = (id) => get(`/api/chat/rooms/${id}`);
export const createRoom = (body) => post('/api/chat/rooms', body);
export const closeRoom = (id) => post(`/api/chat/rooms/${id}/close`);
export const joinRoom = (id) => post(`/api/chat/rooms/${id}/join`);
export const leaveRoom = (id) => post(`/api/chat/rooms/${id}/leave`);
export const getMessages = (id, params) => get(`/api/chat/rooms/${id}/messages`, params);
export const getParticipants = (id) => get(`/api/chat/rooms/${id}/participants`);
