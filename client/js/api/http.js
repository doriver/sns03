import { getAccessToken, setAccessToken, clearAccessToken, setState } from '../store.js';

let refreshing = null;

async function request(url, options = {}, retry = true) {
  const at = getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (at) headers['Authorization'] = `Bearer ${at}`;

  if (options.body && typeof options.body !== 'string') {
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && retry) {
    if (!refreshing) {
      refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
        .then(async (r) => {
          if (!r.ok) throw new Error('refresh failed');
          const data = await r.json();
          setAccessToken(data.data.accessToken);
        })
        .finally(() => { refreshing = null; });
    }
    try {
      await refreshing;
      return request(url, options, false);
    } catch {
      clearAccessToken();
      setState('currentUser', null);
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message || 'Request failed');
    err.code = body?.error?.code;
    err.status = res.status;
    err.details = body?.error?.details;
    throw err;
  }

  const json = await res.json();
  return json.data;
}

export function get(url, query) {
  const qs = query ? '?' + new URLSearchParams(query).toString() : '';
  return request(url + qs, { method: 'GET' });
}

export function post(url, body) { return request(url, { method: 'POST', body }); }
export function patch(url, body) { return request(url, { method: 'PATCH', body }); }
export function del(url) { return request(url, { method: 'DELETE' }); }

export async function postForm(url, formData) {
  const at = getAccessToken();
  const headers = {};
  if (at) headers['Authorization'] = `Bearer ${at}`;
  const res = await fetch(url, { method: 'POST', body: formData, headers, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message || 'Upload failed');
    err.code = body?.error?.code;
    throw err;
  }
  const json = await res.json();
  return json.data;
}

export async function patchForm(url, formData) {
  const at = getAccessToken();
  const headers = {};
  if (at) headers['Authorization'] = `Bearer ${at}`;
  const res = await fetch(url, { method: 'PATCH', body: formData, headers, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message || 'Upload failed');
    err.code = body?.error?.code;
    throw err;
  }
  const json = await res.json();
  return json.data;
}
