import { get, post, patch, del } from './http.js';

export function getComments(postId, params) { return get(`/api/posts/${postId}/comments`, params); }
export function createComment(postId, content) { return post(`/api/posts/${postId}/comments`, { content }); }
export function updateComment(id, content) { return patch(`/api/comments/${id}`, { content }); }
export function deleteComment(id) { return del(`/api/comments/${id}`); }
