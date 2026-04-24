import { getMe, deleteMe } from '../api/users.js';
import { logoutAll } from '../api/auth.js';
import { loader } from '../components/loader.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/modal.js';
import { navigate } from '../router.js';
import { setState } from '../store.js';
import { escHtml, avatarHtml } from '../components/postCard.js';

export async function settingsPage(root) {
  root.innerHTML = loader();
  try {
    const { user } = await getMe();
    setState('currentUser', user);
    render(root, user);
  } catch (e) {
    root.innerHTML = `<p style="color:var(--color-danger)">${escHtml(e.message)}</p>`;
  }
}

function render(root, user) {
  root.innerHTML = `
    <h2 class="page-title">개인 설정</h2>
    <div class="card" style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
      ${avatarHtml(user.profileImage, 'avatar-lg')}
      <div>
        <div style="font-weight:700">${escHtml(user.nickname)}</div>
        <div style="font-size:.85rem;color:var(--color-text-muted)">${escHtml(user.email)}</div>
      </div>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:.5rem">
      <button class="btn-outline" id="btn-logout-all">모든 기기 로그아웃</button>
      <button class="btn-danger" id="btn-delete">회원 탈퇴</button>
    </div>`;

  root.querySelector('#btn-logout-all').addEventListener('click', async () => {
    if (await showConfirm('모든 기기에서 로그아웃하시겠습니까?')) {
      await logoutAll();
      navigate('/');
    }
  });

  root.querySelector('#btn-delete').addEventListener('click', async () => {
    if (await showConfirm('정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.', '회원 탈퇴')) {
      try { await deleteMe(); navigate('/'); } catch (err) { showToast(err.message, 'error'); }
    }
  });
}
