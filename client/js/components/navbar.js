import { getState, subscribe } from '../store.js';
import { logout } from '../api/auth.js';
import { navigate } from '../router.js';
import { showToast } from './toast.js';
import { avatarHtml, escHtml } from './postCard.js';

export function renderNavbar() {
  let closeHandler = null;

  const render = (user) => {
    if (closeHandler) {
      document.removeEventListener('click', closeHandler);
      closeHandler = null;
    }

    const navbar = document.getElementById('navbar');
    const isAdmin = user?.role === 'admin';
    navbar.innerHTML = `
      <div class="nav-inner">
        <a class="nav-logo" href="/" data-link>SNS03</a>
        <div class="nav-links">
          <a href="/posts" data-link>게시판</a>
          ${user ? `
            <a href="/users/${user.id}" data-link>내 프로필</a>
            <a href="/posts/new" data-link>글쓰기</a>
            ${isAdmin ? `<a href="/admin" data-link>관리자</a>` : ''}
            <div class="nav-user">
              <button class="nav-user-trigger" id="btn-user-trigger">
                ${avatarHtml(user.profileImage, 'avatar-sm')}${escHtml(user.nickname)}
              </button>
              <div class="nav-dropdown-menu" id="nav-dropdown">
                <button class="nav-dropdown-item" id="btn-settings">설정</button>
                <button class="nav-dropdown-item danger" id="btn-logout">로그아웃</button>
              </div>
            </div>
          ` : `
            <a href="/login" data-link>로그인</a>
            <a href="/signup" data-link class="btn-primary" style="padding:.35rem .75rem;border-radius:8px;color:#fff">회원가입</a>
          `}
        </div>
      </div>`;

    navbar.querySelectorAll('[data-link]').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); navigate(a.getAttribute('href')); });
    });

    const trigger = navbar.querySelector('#btn-user-trigger');
    const dropdown = navbar.querySelector('#nav-dropdown');

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    closeHandler = (e) => {
      if (!navbar.querySelector('.nav-user')?.contains(e.target)) {
        dropdown?.classList.remove('open');
      }
    };
    document.addEventListener('click', closeHandler);

    navbar.querySelector('#btn-settings')?.addEventListener('click', () => {
      dropdown.classList.remove('open');
      navigate('/settings');
    });

    navbar.querySelector('#btn-logout')?.addEventListener('click', async () => {
      dropdown.classList.remove('open');
      await logout();
      showToast('로그아웃되었습니다', 'info');
      navigate('/');
    });
  };

  render(getState('currentUser'));
  subscribe('currentUser', render);
}
