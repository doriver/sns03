import { getAccessToken, setAccessToken, clearAccessToken, setState } from '../store.js';

let refreshing = null;

async function request(url, options = {}, retry = true) {
  // access토큰을 매 요청마다 헤더에 삽입
  const at = getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (at) headers['Authorization'] = `Bearer ${at}`;

  // body가 객체면 JSON 문자열로 직렬화
  if (options.body && typeof options.body !== 'string') {
    options.body = JSON.stringify(options.body);
  }

  // fetch로 요청함, 응답 받아서 후속 처리
  const res = await fetch(url, { ...options, headers, credentials: 'include' });

  // refresh로 access토큰 재발급 요청
  if (res.status === 401 && retry) {
    // refreshing 프로미스를 공유해, 동시 여러 요청에서 401 발생 시 refresh를 한 번만 실행
    if (!refreshing) {
      refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
        .then(async (r) => {
          if (!r.ok) throw new Error('refresh failed');
          const data = await r.json();
          setAccessToken(data.data.accessToken);
        })
        .finally(() => { refreshing = null; });
    }
    // access 재발급 성공후, 원래 요청 재시도
    try { 
      await refreshing; // 동시 여러 요청 발생할경우, 모두 같은 프로미스를 await  
      return request(url, options, false); // retry=false로 무한 루프 방지
    } catch { // 재발급 실패시, 세션 초기화및 로그인 페이지로
      clearAccessToken();
      setState('currentUser', null);
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  // 서버 에러응답을 호출부에서 활용 가능하게 
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message || 'Request failed');
    err.code = body?.error?.code;
    err.status = res.status;
    err.details = body?.error?.details;
    throw err;
  }
  // 데이터 반환
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
