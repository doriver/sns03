import { route, initRouter, navigate } from './router.js';
import { setAccessToken, setState } from './store.js';
import { renderNavbar } from './components/navbar.js';

import { homePage } from './pages/home.js';
import { loginPage } from './pages/login.js';
import { signupPage } from './pages/signup.js';
import { postListPage } from './pages/postList.js';
import { postDetailPage } from './pages/postDetail.js';
import { postEditorPage } from './pages/postEditor.js';
import { profilePage } from './pages/profile.js';
import { mePage } from './pages/me.js';
import { adminPage } from './pages/admin.js';

async function restoreSession() {
  const at = sessionStorage.getItem('at');
  if (!at) return;
  try {
    const res = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${at}` }, credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setState('currentUser', json.data.user);
    } else if (res.status === 401) {
      const refreshRes = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (refreshRes.ok) {
        const rd = await refreshRes.json();
        setAccessToken(rd.data.accessToken);
        const res2 = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${rd.data.accessToken}` }, credentials: 'include' });
        if (res2.ok) { const j2 = await res2.json(); setState('currentUser', j2.data.user); }
      } else { sessionStorage.removeItem('at'); }
    }
  } catch { sessionStorage.removeItem('at'); }
}

route('/', homePage);
route('/login', loginPage);
route('/signup', signupPage);
route('/posts', postListPage);
route('/posts/new', (r) => postEditorPage(r, {}), { auth: true });
route('/posts/:id/edit', postEditorPage, { auth: true });
route('/posts/:id', postDetailPage);
route('/users/:id', profilePage);
route('/me', mePage, { auth: true });
route('/admin', adminPage, { auth: true, admin: true });
route('/admin/:tab', adminPage, { auth: true, admin: true });

(async () => {
  await restoreSession();
  renderNavbar();
  initRouter();
})();
