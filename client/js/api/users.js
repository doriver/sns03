import { get, post, del, patchForm } from './http.js';

export function getMe() { return get('/api/users/me'); }
export function getUser(id) { return get(`/api/users/${id}`); }
export function deleteMe() { return del('/api/users/me'); }
export function updateMe(formData) { return patchForm('/api/users/me', formData); }
export function follow(id) { return post(`/api/users/${id}/follow`); }
export function unfollow(id) { return del(`/api/users/${id}/follow`); }
export function getFollowers(id, params) { return get(`/api/users/${id}/followers`, params); }
export function getFollowing(id, params) { return get(`/api/users/${id}/following`, params); }
