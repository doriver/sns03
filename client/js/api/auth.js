import { post } from './http.js';
import { setAccessToken, clearAccessToken, setState } from '../store.js';

export async function signup(data) { return post('/api/auth/signup', data); }

export async function login(data) {
  const res = await post('/api/auth/login', data);
  setAccessToken(res.accessToken);
  setState('currentUser', res.user);
  return res;
}

export async function logout() {
  await post('/api/auth/logout').catch(() => {});
  clearAccessToken();
  setState('currentUser', null);
}

export async function logoutAll() {
  await post('/api/auth/logout-all').catch(() => {});
  clearAccessToken();
  setState('currentUser', null);
}
