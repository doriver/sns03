import { getState, subscribe } from '../store.js';
import { logout } from '../api/auth.js';
import { navigate } from '../router.js';
import { showToast } from './toast.js';
import { avatarHtml, escHtml } from './postCard.js';

export function renderNavbar() {
  const render = (user) => {
    const navbar = document.getElementById('navbar');
    const isAdmin = user?.role === 'admin';
    navbar.innerHTML = `
      <div class="nav-inner">
        <a class="nav-logo" href="/" data-link>SNS03</a>
        <div class="nav-links">
          <a href="/posts" data-link>게시판</a>
          ${user ? `
            <a href="/posts/new" data-link>글쓰기</a>
            <a href="/me" data-link style="display:inline-flex;align-items:center;gap:.3rem">${avatarHtml(user.profileImage, 'avatar-sm')}${escHtml(user.nickname)}</a>
            ${isAdmin ? `<a href="/admin" data-link>관리자</a>` : ''}
            <button class="btn-outline btn-sm" id="btn-logout">로그아웃</button>
          ` : `
            <a href="/login" data-link>로그인</a>
            <a href="/signup" data-link class="btn-primary" style="padding:.35rem .75rem;border-radius:8px;color:#fff">회원가입</a>
          `}
        </div>
      </div>`;

    navbar.querySelectorAll('[data-link]').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); navigate(a.getAttribute('href')); });
    });

    navbar.querySelector('#btn-logout')?.addEventListener('click', async () => {
      await logout();
      showToast('로그아웃되었습니다', 'info');
      navigate('/');
    });
  };

  render(getState('currentUser'));
  subscribe('currentUser', render);
}
