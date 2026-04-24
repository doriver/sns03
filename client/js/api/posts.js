import { get, post, del, postForm, patchForm } from './http.js';

export function getTimeline() { return get('/api/posts/timeline'); }
export function getPosts(params) { return get('/api/posts', params); }
export function getPost(id) { return get(`/api/posts/${id}`); }
export function deletePost(id) { return del(`/api/posts/${id}`); }
export function likePost(id) { return post(`/api/posts/${id}/like`); }
export async function createPost(formData) { return postForm('/api/posts', formData); }
export async function updatePost(id, formData) { return patchForm(`/api/posts/${id}`, formData); }
