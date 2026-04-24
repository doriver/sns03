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
        ${!isMe && me ? `<button class="btn-outline btn-sm" style="margin-top:.5rem" id="btn-follow">${user.isFollowing ? '언팔로우' : '팔로우'}</button>` : ''}
        ${isMe ? `<button class="btn-outline btn-sm" style="margin-top:.5rem" id="btn-edit-profile">프로필 편집</button>` : ''}
      </div>
    </div>
    <div id="user-posts"></div>`;

  root.querySelector('#follower-count').addEventListener('click', () => openFollowModal(id, 'followers'));
  root.querySelector('#following-count').addEventListener('click', () => openFollowModal(id, 'following'));

  root.querySelector('#btn-edit-profile')?.addEventListener('click', () => {
    openEditModal(user, (updated) => render(root, updated, id));
  });

  root.querySelector('#btn-follow')?.addEventListener('click', async (e) => {
    const isCurrentlyFollowing = e.target.textContent.trim() === '언팔로우';
    try {
      if (isCurrentlyFollowing) {
        await unfollow(id);
        e.target.textContent = '팔로우';
        showToast('언팔로우했습니다', 'info');
      } else {
        await follow(id);
        e.target.textContent = '언팔로우';
        showToast('팔로우했습니다', 'info');
      }
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

function openFollowModal(userId, activeTab) {
  const modalRoot = document.getElementById('modal-root');

  const renderTab = async (tab) => {
    const listEl = modalRoot.querySelector('#follow-list');
    listEl.innerHTML = '<p style="color:var(--color-text-muted);font-size:.875rem">불러오는 중...</p>';
    try {
      const fetcher = tab === 'followers' ? getFollowers : getFollowing;
      const result = await fetcher(userId);
      const users = result.items ?? result.users ?? result.data ?? [];
      if (!users.length) {
        listEl.innerHTML = '<p style="color:var(--color-text-muted);font-size:.875rem">목록이 없습니다.</p>';
        return;
      }
      listEl.innerHTML = '';
      users.forEach((u) => {
        const item = document.createElement('div');
        item.className = 'follow-modal-item';
        item.innerHTML = `
          <img class="avatar avatar-sm" src="${u.profileImage || '/assets/default-avatar.svg'}" alt="" />
          <span>${escHtml(u.nickname)}</span>`;
        item.style.cssText = 'display:flex;align-items:center;gap:.6rem;padding:.5rem 0;cursor:pointer';
        item.addEventListener('click', () => { modalRoot.innerHTML = ''; navigate(`/users/${u._id ?? u.id}`); });
        listEl.appendChild(item);
      });
    } catch (e) {
      listEl.innerHTML = `<p style="color:var(--color-danger);font-size:.875rem">${escHtml(e.message)}</p>`;
    }
  };

  const switchTab = (tab) => {
    modalRoot.querySelectorAll('.follow-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    renderTab(tab);
  };

  modalRoot.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box" style="min-width:300px;max-width:360px">
        <div style="display:flex;gap:.5rem;margin-bottom:1rem;border-bottom:1px solid var(--color-border);padding-bottom:.5rem">
          <button class="follow-tab-btn" data-tab="followers" style="flex:1;background:none;border:none;cursor:pointer;padding:.4rem;font-size:.875rem;border-radius:var(--radius)">팔로워</button>
          <button class="follow-tab-btn" data-tab="following" style="flex:1;background:none;border:none;cursor:pointer;padding:.4rem;font-size:.875rem;border-radius:var(--radius)">팔로잉</button>
        </div>
        <div id="follow-list" style="max-height:320px;overflow-y:auto"></div>
        <div style="text-align:right;margin-top:.75rem">
          <button class="btn-outline" id="follow-modal-close">닫기</button>
        </div>
      </div>
    </div>`;

  modalRoot.querySelector('#follow-modal-close').addEventListener('click', () => { modalRoot.innerHTML = ''; });
  modalRoot.querySelector('.modal-overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) modalRoot.innerHTML = ''; });
  modalRoot.querySelectorAll('.follow-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  switchTab(activeTab);
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
