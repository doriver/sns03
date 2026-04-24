import { navigate } from '../router.js';
import { escHtml, formatDate } from './postCard.js';

export function postRow(post) {
  const el = document.createElement('div');
  el.className = 'post-row';
  const authorName = post.author?.nickname || '탈퇴한 사용자';
  el.innerHTML = `
    <div class="post-row-title">${escHtml(post.title)}</div>
    <div class="post-row-meta">
      <span>${escHtml(authorName)}</span>
      <span>·</span>
      <span>❤ ${post.likeCount}</span>
      <span>💬 ${post.commentCount}</span>
      <span>·</span>
      <span>${formatDate(post.createdAt)}</span>
    </div>`;
  el.addEventListener('click', () => navigate(`/posts/${post.id}`));
  return el;
}
