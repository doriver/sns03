import { getState } from './store.js';

const routes = [];
let currentCleanup = null;

export function route(path, component, { auth = false, admin = false } = {}) {
  routes.push({ path, component, auth, admin });
}

export function navigate(path) {
  history.pushState(null, '', path);
  render(path);
}

async function render(path) {
  const root = document.getElementById('page-root');

  // 이전 페이지 정리(소켓 연결 해제 등)
  if (currentCleanup) { currentCleanup(); currentCleanup = null; }

  // 현제 path에 맞는 라우트 찾기
  const match = matchRoute(path);
  if (!match) { root.innerHTML = '<p>페이지를 찾을 수 없습니다.</p>'; return; }

  const { route: r, params } = match;

  if (r.auth) {
    const user = getState('currentUser');
    if (!user) { navigate('/login?redirect=' + encodeURIComponent(path)); return; }
    if (r.admin && user.role !== 'admin') { navigate('/'); return; }
  }

  // 페이지 렌더링
  root.innerHTML = '';
  currentCleanup = await r.component(root, params) || null; // 페이지 함수 실행( root DOM에 직접 HTML씀 )
}

function matchRoute(path) {
  const clean = path.split('?')[0];
  for (const r of routes) {
    if (typeof r.path === 'string') {
      const paramNames = [];
      const regex = new RegExp('^' + r.path.replace(/:([^/]+)/g, (_, name) => { paramNames.push(name); return '([^/]+)'; }) + '$');
      const m = clean.match(regex);
      if (m) {
        const params = {};
        paramNames.forEach((name, i) => { params[name] = m[i + 1]; });
        return { route: r, params };
      }
    } else if (r.path instanceof RegExp) {
      const m = clean.match(r.path);
      if (m) return { route: r, params: {} };
    }
  }
  return null;
}

export function initRouter() {
  window.addEventListener('popstate', () => render(location.pathname + location.search));
  render(location.pathname + location.search);
}
