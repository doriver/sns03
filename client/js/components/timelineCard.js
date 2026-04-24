import { navigate } from '../router.js';
import { escHtml, formatDate, avatarHtml } from './postCard.js';

export function timelineCard(post) {
  const el = document.createElement('div');
  el.className = 'card timeline-card';

  const authorName = post.author?.nickname || '탈퇴한 사용자';
  const badge =
    post.author?.role === 'popular'
      ? '<span class="badge badge-popular">popular</span>'
      : post.author?.role === 'admin'
        ? '<span class="badge badge-admin">admin</span>'
        : '';

  const thumbHtml = post.images?.length
    ? `<div class="timeline-card-thumb-wrap">
        <img class="timeline-card-thumb" src="${escHtml(post.images[0])}" alt="" loading="lazy">
        ${post.images.length > 1 ? `<span class="timeline-card-thumb-more">+${post.images.length - 1}</span>` : ''}
       </div>`
    : '';

  const comments = Array.isArray(post.recentComments) ? [...post.recentComments].reverse() : [];
  const commentsHtml =
    comments.length
      ? `<div class="timeline-card-comments">
          ${comments
            .map(
              (c) =>
                `<div class="comment-preview"><span class="comment-preview-author">${escHtml(c.author?.nickname || '탈퇴한 사용자')}</span> ${escHtml(c.content)}</div>`
            )
            .join('')}
          ${post.commentCount > comments.length
            ? `<a class="timeline-card-more-comments" data-id="${post.id}">댓글 ${post.commentCount}개 모두 보기</a>`
            : ''}
        </div>`
      : '';

  el.innerHTML = `
    <div class="timeline-card-header">
      ${avatarHtml(post.author?.profileImage, 'avatar-sm')}
      <span class="timeline-card-author">${escHtml(authorName)}</span>${badge}
      <span class="timeline-card-time">${formatDate(post.createdAt)}</span>
    </div>
    <div class="timeline-card-title">${escHtml(post.title)}</div>
    <div class="timeline-card-body">${escHtml(post.content || '')}</div>
    ${thumbHtml}
    <div class="post-card-stats">
      <span>👁 ${post.viewCount}</span>
      <span>❤ ${post.likeCount}</span>
      <span>💬 ${post.commentCount}</span>
    </div>
    ${commentsHtml}`;

  const goDetail = () => navigate(`/posts/${post.id}`);
  el.querySelector('.timeline-card-title').addEventListener('click', goDetail);
  el.querySelector('.timeline-card-body').addEventListener('click', goDetail);
  el.querySelector('.timeline-card-thumb')?.addEventListener('click', goDetail);
  el.querySelector('.timeline-card-more-comments')?.addEventListener('click', goDetail);

  return el;
}
