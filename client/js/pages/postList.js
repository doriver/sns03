import { getPosts } from '../api/posts.js';
import { postCard } from '../components/postCard.js';
import { loader } from '../components/loader.js';
import { navigate } from '../router.js';
import { getState } from '../store.js';

export async function postListPage(root) {
  let cursor = null;
  let loading = false;

  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 class="page-title" style="margin:0">게시판</h2>
      ${getState('currentUser') ? `<button class="btn-primary btn-sm" id="btn-new">글쓰기</button>` : ''}
    </div>
    <div id="post-list"></div>
    <div id="list-loader"></div>
    <div id="sentinel" style="height:1px"></div>`;

  root.querySelector('#btn-new')?.addEventListener('click', () => navigate('/posts/new'));

  const listEl = root.querySelector('#post-list');
  const loaderEl = root.querySelector('#list-loader');

  async function loadMore() {
    if (loading) return;
    loading = true;
    loaderEl.innerHTML = loader();
    try {
      const result = await getPosts({ cursor: cursor || undefined, limit: 20 });
      result.items.forEach((p) => listEl.appendChild(postCard(p)));
      cursor = result.nextCursor;
      if (!result.hasMore) observer.disconnect();
    } catch (e) {
      loaderEl.innerHTML = `<p style="color:var(--color-danger);text-align:center">${e.message}</p>`;
    } finally {
      loaderEl.innerHTML = '';
      loading = false;
    }
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadMore();
  }, { threshold: 0 });

  observer.observe(root.querySelector('#sentinel'));

  return () => observer.disconnect();
}
