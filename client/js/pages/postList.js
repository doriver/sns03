import { getPosts } from '../api/posts.js';
import { postRow } from '../components/postRow.js';
import { loader } from '../components/loader.js';
import { navigate } from '../router.js';
import { getState } from '../store.js';
import { escHtml } from '../components/postCard.js';

export async function postListPage(root) {
  let currentPage = 1;
  let totalPages = 1;

  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 class="page-title" style="margin:0">게시판</h2>
      ${getState('currentUser') ? `<button class="btn-primary btn-sm" id="btn-new">글쓰기</button>` : ''}
    </div>
    <div id="post-list" class="card" style="padding:0;overflow:hidden"></div>
    <div id="list-loader"></div>
    <div id="pagination" class="pagination"></div>`;

  root.querySelector('#btn-new')?.addEventListener('click', () => navigate('/posts/new'));

  const listEl = root.querySelector('#post-list');
  const loaderEl = root.querySelector('#list-loader');
  const paginationEl = root.querySelector('#pagination');

  function renderPagination() {
    if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }

    const range = [];
    const delta = 2;
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);

    for (let i = left; i <= right; i++) range.push(i);

    let html = `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">이전</button>`;
    if (left > 1) html += `<button data-page="1">1</button>${left > 2 ? '<span>…</span>' : ''}`;
    range.forEach((n) => {
      html += `<button class="${n === currentPage ? 'active' : ''}" data-page="${n}">${n}</button>`;
    });
    if (right < totalPages) html += `${right < totalPages - 1 ? '<span>…</span>' : ''}<button data-page="${totalPages}">${totalPages}</button>`;
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">다음</button>`;

    paginationEl.innerHTML = html;
    paginationEl.querySelectorAll('button[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => loadPage(Number(btn.dataset.page)));
    });
  }

  async function loadPage(pageNum) {
    loaderEl.innerHTML = loader();
    listEl.innerHTML = '';
    try {
      const result = await getPosts({ page: pageNum, limit: 10 });
      currentPage = result.page;
      totalPages = result.totalPages;

      if (!result.items.length) {
        listEl.innerHTML = '<p style="padding:1.5rem;color:var(--color-text-muted);text-align:center">게시글이 없습니다.</p>';
      } else {
        result.items.forEach((p) => listEl.appendChild(postRow(p, currentPage)));
      }
      renderPagination();
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      listEl.innerHTML = `<p style="padding:1.5rem;color:var(--color-danger);text-align:center">${escHtml(e.message)}</p>`;
    } finally {
      loaderEl.innerHTML = '';
    }
  }

  const initialPage = parseInt(new URLSearchParams(location.search).get('page') || '1', 10);
  loadPage(initialPage);
}
