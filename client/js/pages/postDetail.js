import { getPost, deletePost } from '../api/posts.js';
import { post as apiPost } from '../api/http.js';
import { getComments, createComment, deleteComment } from '../api/comments.js';
import { loader } from '../components/loader.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/modal.js';
import { navigate } from '../router.js';
import { getState } from '../store.js';
import { formatDate, escHtml, avatarHtml } from '../components/postCard.js';

export async function postDetailPage(root, { id }) {
  root.innerHTML = loader();
  try {
    const { post } = await getPost(id);
    renderPost(root, post, id);
  } catch (e) {
    root.innerHTML = `<p style="color:var(--color-danger)">${escHtml(e.message)}</p>`;
  }
}

function renderPost(root, post, id) {
  const user = getState('currentUser');
  const isOwner = user && post.author?.id === user.id;
  const isAdmin = user?.role === 'admin';

  const images = post.images?.map((url) => `<img src="${escHtml(url)}" alt="" style="max-width:100%;border-radius:8px;margin-top:.5rem">`).join('') || '';

  root.innerHTML = `
    <div class="card">
      <h1 style="font-size:1.3rem;font-weight:700;margin-bottom:.5rem">${escHtml(post.title)}</h1>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div style="font-size:.8rem;color:var(--color-text-muted)">
          <a href="/users/${post.author?.id}" data-link style="display:inline-flex;align-items:center;gap:.3rem">${avatarHtml(post.author?.profileImage, 'avatar-sm')}${escHtml(post.author?.nickname || '탈퇴한 사용자')}</a>
          · ${formatDate(post.createdAt)} · 👁 ${post.viewCount} · ❤ <span id="like-count">${post.likeCount}</span>
        </div>
        ${(isOwner || isAdmin) ? `
          <div style="display:flex;gap:.5rem">
            ${isOwner ? `<button class="btn-outline btn-sm" id="btn-edit">수정</button>` : ''}
            <button class="btn-danger btn-sm" id="btn-delete">삭제</button>
          </div>` : ''}
      </div>
      <div style="white-space:pre-wrap;line-height:1.7">${escHtml(post.content)}</div>
      ${images}
      <div style="margin-top:1rem;display:flex;gap:.5rem;align-items:center">
        ${user ? `<button class="btn-outline btn-sm" id="btn-like">❤ 좋아요</button>` : ''}
      </div>
    </div>
    <div id="comments-section" style="margin-top:1.5rem"></div>`;

  root.querySelector('[data-link]')?.addEventListener('click', (e) => { e.preventDefault(); navigate(`/users/${post.author?.id}`); });

  root.querySelector('#btn-edit')?.addEventListener('click', () => navigate(`/posts/${id}/edit`));
  root.querySelector('#btn-delete')?.addEventListener('click', async () => {
    if (await showConfirm('게시글을 삭제하시겠습니까?')) {
      try { await deletePost(id); showToast('삭제됐습니다', 'success'); navigate('/posts'); } catch (e) { showToast(e.message, 'error'); }
    }
  });

  root.querySelector('#btn-like')?.addEventListener('click', async () => {
    try {
      const res = await apiPost(`/api/posts/${id}/like`);
      const countEl = root.querySelector('#like-count');
      countEl.textContent = parseInt(countEl.textContent) + (res.liked ? 1 : -1);
    } catch (e) { showToast(e.message, 'error'); }
  });

  loadComments(root.querySelector('#comments-section'), id);
}

async function loadComments(section, postId) {
  let page = 1;

  async function fetch() {
    section.innerHTML = loader();
    const res = await getComments(postId, { page, size: 20 });
    renderComments(section, postId, res, () => { page++; fetch(); });
  }
  fetch();
}

function renderComments(section, postId, res, loadMore) {
  const user = getState('currentUser');
  section.innerHTML = `<h3 style="font-weight:700;margin-bottom:.75rem">댓글 ${res.total}개</h3>`;

  if (user) {
    const form = document.createElement('form');
    form.className = 'card';
    form.style.marginBottom = '.75rem';
    form.innerHTML = `
      <textarea name="content" placeholder="댓글을 작성하세요 (최대 500자)" maxlength="500" rows="3"></textarea>
      <div id="comment-err" class="form-error"></div>
      <button class="btn-primary btn-sm" style="margin-top:.5rem" type="submit">등록</button>`;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = form.querySelector('textarea').value.trim();
      if (!content) return;
      try {
        await createComment(postId, content);
        page = 1;
        loadMore();
      } catch (err) { form.querySelector('#comment-err').textContent = err.message; }
    });
    section.appendChild(form);
  }

  const list = document.createElement('div');
  list.className = 'card';
  if (!res.items.length) { list.innerHTML = '<p style="color:var(--color-text-muted)">댓글이 없습니다.</p>'; }
  res.items.forEach((c) => {
    const el = document.createElement('div');
    el.className = 'comment-item';
    const isOwner = user && c.author?.id === user.id;
    const isAdmin = user?.role === 'admin';
    el.innerHTML = `
      <div class="comment-meta">
        ${avatarHtml(c.author?.profileImage, 'avatar-sm')}
        <strong>${escHtml(c.author?.nickname || '탈퇴한 사용자')}</strong>
        <span>${formatDate(c.createdAt)}</span>
        ${(isOwner || isAdmin) ? `<button class="btn-danger btn-sm" data-del="${c.id}">삭제</button>` : ''}
      </div>
      <div>${escHtml(c.content)}</div>`;
    el.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (await showConfirm('댓글을 삭제하시겠습니까?')) {
        try { await deleteComment(c.id); showToast('삭제됐습니다', 'success'); loadMore(); } catch (err) { showToast(err.message, 'error'); }
      }
    });
    list.appendChild(el);
  });
  section.appendChild(list);

  if (res.page < res.totalPages) {
    const btn = document.createElement('button');
    btn.className = 'btn-outline';
    btn.style.cssText = 'width:100%;margin-top:.5rem';
    btn.textContent = '더 보기';
    btn.addEventListener('click', loadMore);
    section.appendChild(btn);
  }
}
