import { get, post, patch, del } from './http.js';

export function getUsers(params) { return get('/api/admin/users', params); }
export function changeRole(id, role, reason) { return patch(`/api/admin/users/${id}/role`, { role, reason }); }
export function banUser(id, reason, forceDelete) { return post(`/api/admin/users/${id}/ban`, { reason, forceDelete }); }
export function togglePostHidden(id) { return patch(`/api/admin/posts/${id}/hidden`); }
export function deletePost(id) { return del(`/api/admin/posts/${id}`); }
export function deleteComment(id) { return del(`/api/admin/comments/${id}`); }
export function getStats() { return get('/api/admin/stats'); }
