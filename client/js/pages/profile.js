import { getUser, updateMe, follow, unfollow, getFollowers, getFollowing } from '../api/users.js';
import { getPosts } from '../api/posts.js';
import { postCard, escHtml } from '../components/postCard.js';
import { loader } from '../components/loader.js';
import { showToast } from '../components/toast.js';
import { getState, setState } from '../store.js';
import { navigate } from '../router.js';

export async function profilePage(root, { id }) {
  root.innerHTML = loader();
  try {
    const { user } = await getUser(id);
    render(root, user, id);
  } catch (e) {
    root.innerHTML = `<p style="color:var(--color-danger)">${escHtml(e.message)}</p>`;
  }
}

function render(root, user, id) {
  const me = getState('currentUser');
  const isMe = me && String(me.id) === String(user.id);
  const badge = user.role === 'popular' ? '<span class="badge badge-popular">popular</span>' : user.role === 'admin' ? '<span class="badge badge-admin">admin</span>' : '';

  root.innerHTML = `
    <h2 class="page-title">프로필</h2>
    <div class="card profile-header">
      <img class="avatar avatar-lg" src="${user.profileImage || '/assets/default-avatar.svg'}" alt="" />
      <div class="profile-info">
        <h2>${escHtml(user.nickname)} ${badge}</h2>
        <div class="profile-stats">
          <span id="follower-count" style="cursor:pointer">팔로워 ${user.followerCount}</span>
          <span id="following-count" style="cursor:pointer">팔로잉 ${user.followingCount}</span>
        </div>
        ${!isMe && me ? `<button class="btn-outline btn-sm" style="margin-top:.5rem" id="btn-follow">팔로우</button>` : ''}
        ${isMe ? `<button class="btn-outline btn-sm" style="margin-top:.5rem" id="btn-edit-profile">프로필 편집</button>` : ''}
      </div>
    </div>
    <div id="user-posts"></div>`;

  root.querySelector('#btn-edit-profile')?.addEventListener('click', () => {
    openEditModal(user, (updated) => render(root, updated, id));
  });

  root.querySelector('#btn-follow')?.addEventListener('click', async (e) => {
    try {
      const res = await follow(id);
      e.target.textContent = res.following ? '언팔로우' : '팔로우';
      e.target.onclick = async () => { const r = await unfollow(id); e.target.textContent = r.following ? '언팔로우' : '팔로우'; };
      showToast(res.following ? '팔로우했습니다' : '언팔로우했습니다', 'info');
    } catch (err) { showToast(err.message, 'error'); }
  });

  loadUserPosts(root.querySelector('#user-posts'), id);
}

function openEditModal(user, onSaved) {
  const modalRoot = document.getElementById('modal-root');
  modalRoot.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>프로필 편집</h3>
        <form id="edit-profile-form">
          <div class="form-group">
            <label>닉네임</label>
            <input type="text" name="nickname" value="${escHtml(user.nickname)}" minlength="2" maxlength="20" required />
          </div>
          <div class="form-group">
            <label>프로필 이미지</label>
            <div style="display:flex;align-items:center;gap:.75rem;margin-top:.25rem">
              <img id="modal-avatar-preview" class="avatar avatar-lg" src="${user.profileImage || '/assets/default-avatar.svg'}" alt="" />
              <input type="file" name="profileImage" accept="image/jpeg,image/png,image/webp" id="modal-avatar-input" />
            </div>
          </div>
          <div id="modal-form-err" class="form-error"></div>
          <div class="modal-actions">
            <button type="button" class="btn-outline" id="modal-cancel">취소</button>
            <button type="submit" class="btn-primary">저장</button>
          </div>
        </form>
      </div>
    </div>`;

  const close = () => { modalRoot.innerHTML = ''; };
  modalRoot.querySelector('#modal-cancel').onclick = close;
  modalRoot.querySelector('.modal-overlay').onclick = (e) => { if (e.target === e.currentTarget) close(); };

  modalRoot.querySelector('#modal-avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) modalRoot.querySelector('#modal-avatar-preview').src = URL.createObjectURL(file);
  });

  modalRoot.querySelector('#edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = modalRoot.querySelector('#modal-form-err');
    try {
      const { user: updated } = await updateMe(fd);
      setState('currentUser', updated);
      showToast('저장됐습니다', 'success');
      close();
      onSaved(updated);
    } catch (err) { errEl.textContent = err.message; }
  });
}

async function loadUserPosts(el, authorId) {
  el.innerHTML = loader();
  try {
    const result = await getPosts({ authorId });
    el.innerHTML = '<h3 style="font-weight:600;margin-bottom:.75rem">게시글</h3>';
    if (!result.items.length) { el.innerHTML += '<p style="color:var(--color-text-muted)">게시글이 없습니다.</p>'; return; }
    result.items.forEach((p) => el.appendChild(postCard(p)));
  } catch (e) {
    el.innerHTML = `<p style="color:var(--color-danger)">${escHtml(e.message)}</p>`;
  }
}
