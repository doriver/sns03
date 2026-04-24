import { navigate } from '../router.js';

export function postCard(post) {
  const el = document.createElement('div');
  el.className = 'card post-card';
  const authorName = post.author?.nickname || '탈퇴한 사용자';
  const badge = post.author?.role === 'popular' ? '<span class="badge badge-popular">popular</span>' : post.author?.role === 'admin' ? '<span class="badge badge-admin">admin</span>' : '';
  el.innerHTML = `
    <div class="post-card-meta">
      <span>${authorName}</span>${badge}
      <span>·</span>
      <span>${formatDate(post.createdAt)}</span>
    </div>
    <div class="post-card-title">${escHtml(post.title)}</div>
    <div class="post-card-excerpt">${escHtml(post.content || '')}</div>
    <div class="post-card-stats">
      <span>👁 ${post.viewCount}</span>
      <span>❤ ${post.likeCount}</span>
      <span>💬 ${post.commentCount}</span>
    </div>`;
  el.addEventListener('click', () => navigate(`/posts/${post.id}`));
  return el;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return '방금 전';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return d.toLocaleDateString('ko-KR');
}

export function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
