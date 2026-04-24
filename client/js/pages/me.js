import { getMe, updateMe, deleteMe } from '../api/users.js';
import { logoutAll } from '../api/auth.js';
import { loader } from '../components/loader.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/modal.js';
import { navigate } from '../router.js';
import { setState } from '../store.js';
import { escHtml } from '../components/postCard.js';

export async function mePage(root) {
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
    <h2 class="page-title">내 정보</h2>
    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
        <img id="avatar-preview" class="avatar avatar-lg" src="${user.profileImage || '/assets/default-avatar.svg'}" alt="" />
        <div>
          <div style="font-weight:700">${escHtml(user.nickname)}</div>
          <div style="font-size:.85rem;color:var(--color-text-muted)">${escHtml(user.email)}</div>
        </div>
      </div>
      <form id="profile-form">
        <div class="form-group">
          <label>닉네임</label>
          <input type="text" name="nickname" value="${escHtml(user.nickname)}" minlength="2" maxlength="20" required />
        </div>
        <div class="form-group">
          <label>프로필 이미지</label>
          <input type="file" name="profileImage" accept="image/jpeg,image/png,image/webp" id="avatar-input" />
        </div>
        <div id="form-err" class="form-error"></div>
        <button type="submit" class="btn-primary" style="margin-top:.5rem">저장</button>
      </form>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:.5rem">
      <button class="btn-outline" id="btn-logout-all">모든 기기 로그아웃</button>
      <button class="btn-danger" id="btn-delete">회원 탈퇴</button>
    </div>`;

  root.querySelector('#avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) root.querySelector('#avatar-preview').src = URL.createObjectURL(file);
  });

  root.querySelector('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = root.querySelector('#form-err');
    try {
      const { user: updated } = await updateMe(fd);
      setState('currentUser', updated);
      showToast('저장됐습니다', 'success');
    } catch (err) { errEl.textContent = err.message; }
  });

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
