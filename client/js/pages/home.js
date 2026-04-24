import { getTimeline } from '../api/posts.js';
import { timelineCard } from '../components/timelineCard.js';
import { escHtml } from '../components/postCard.js';
import { loader } from '../components/loader.js';
import { navigate } from '../router.js';

export async function homePage(root) {
  root.innerHTML = `<h2 class="page-title">타임라인</h2>${loader()}`;
  try {
    const { items } = await getTimeline();
    const list = document.createElement('div');
    if (!items.length) {
      list.innerHTML = '<p style="color:var(--color-text-muted)">게시글이 없습니다.</p>';
    } else {
      items.forEach((p) => list.appendChild(timelineCard(p)));
    }
    root.innerHTML = '<h2 class="page-title">🔥 인기 게시글</h2>';
    root.appendChild(list);
  } catch (e) {
    root.innerHTML = `<p style="color:var(--color-danger)">${escHtml(e.message)}</p>`;
  }
}
