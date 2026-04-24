const state = { currentUser: null };
const listeners = {};

export function getState(key) { return state[key]; }

export function setState(key, value) {
  state[key] = value;
  (listeners[key] || []).forEach((fn) => fn(value));
}

export function subscribe(key, fn) {
  if (!listeners[key]) listeners[key] = [];
  listeners[key].push(fn);
  return () => { listeners[key] = listeners[key].filter((f) => f !== fn); };
}

export function getAccessToken() { return sessionStorage.getItem('at'); }
export function setAccessToken(token) { sessionStorage.setItem('at', token); }
export function clearAccessToken() { sessionStorage.removeItem('at'); }
