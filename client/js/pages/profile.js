import { getUser } from '../api/users.js';
import { follow, unfollow, getFollowers, getFollowing } from '../api/users.js';
import { getPosts } from '../api/posts.js';
import { postCard, escHtml } from '../components/postCard.js';
import { loader } from '../components/loader.js';
import { showToast } from '../components/toast.js';
import { getState } from '../store.js';
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
    <div class="card profile-header">
      <img class="avatar avatar-lg" src="${user.profileImage || '/assets/default-avatar.svg'}" alt="" />
      <div class="profile-info">
        <h2>${escHtml(user.nickname)} ${badge}</h2>
        <div class="profile-stats">
          <span>게시글</span>
          <span id="follower-count" style="cursor:pointer">팔로워 ${user.followerCount}</span>
          <span id="following-count" style="cursor:pointer">팔로잉 ${user.followingCount}</span>
        </div>
        ${!isMe && me ? `<button class="btn-outline btn-sm" style="margin-top:.5rem" id="btn-follow">팔로우</button>` : ''}
        ${isMe ? `<a href="/me" data-link><button class="btn-outline btn-sm" style="margin-top:.5rem">프로필 편집</button></a>` : ''}
      </div>
    </div>
    <div id="user-posts"></div>`;

  root.querySelector('[data-link]')?.addEventListener('click', (e) => { e.preventDefault(); navigate('/me'); });

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
