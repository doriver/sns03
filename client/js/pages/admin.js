import { getUsers, changeRole, banUser, getStats, togglePostHidden, deletePost as adminDeletePost } from '../api/admin.js';
import { loader } from '../components/loader.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/modal.js';
import { escHtml, formatDate } from '../components/postCard.js';
import { getPosts } from '../api/posts.js';

export async function adminPage(root) {
  root.innerHTML = `
    <h2 class="page-title">관리자</h2>
    <div class="tabs">
      <button class="tab-btn active" data-tab="stats">대시보드</button>
      <button class="tab-btn" data-tab="users">회원 관리</button>
      <button class="tab-btn" data-tab="content">콘텐츠 관리</button>
    </div>
    <div id="tab-content"></div>`;

  const tabContent = root.querySelector('#tab-content');
  const tabs = root.querySelectorAll('.tab-btn');
  let activeTab = 'stats';

  async function switchTab(tab) {
    activeTab = tab;
    tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    tabContent.innerHTML = loader();
    if (tab === 'stats') await renderStats(tabContent);
    else if (tab === 'users') await renderUsers(tabContent);
    else await renderContent(tabContent);
  }

  tabs.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  switchTab('stats');
}

async function renderStats(el) {
  try {
    const { stats } = await getStats();
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem;margin-bottom:1.5rem">
        ${[['전체 회원', stats.userCount], ['전체 게시글', stats.postCount], ['전체 댓글', stats.commentCount], ['오늘 DAU', stats.dau]].map(([label, val]) => `
          <div class="card" style="text-align:center">
            <div style="font-size:1.5rem;font-weight:700;color:var(--color-primary)">${val}</div>
            <div style="font-size:.8rem;color:var(--color-text-muted)">${label}</div>
          </div>`).join('')}
      </div>
      <div class="card">
        <h3 style="font-weight:600;margin-bottom:.75rem">최근 7일 가입 추이</h3>
        ${stats.userTrend.map((d) => `<div style="display:flex;justify-content:space-between;font-size:.85rem;padding:.2rem 0"><span>${d._id}</span><span>${d.count}명</span></div>`).join('') || '<p style="color:var(--color-text-muted)">데이터 없음</p>'}
      </div>
      <div class="card" style="margin-top:.75rem">
        <h3 style="font-weight:600;margin-bottom:.75rem">최근 7일 게시글 추이</h3>
        ${stats.postTrend.map((d) => `<div style="display:flex;justify-content:space-between;font-size:.85rem;padding:.2rem 0"><span>${d._id}</span><span>${d.count}개</span></div>`).join('') || '<p style="color:var(--color-text-muted)">데이터 없음</p>'}
      </div>`;
  } catch (e) { el.innerHTML = `<p style="color:var(--color-danger)">${escHtml(e.message)}</p>`; }
}

async function renderUsers(el, page = 1) {
  try {
    el.innerHTML = `
      <div style="display:flex;gap:.5rem;margin-bottom:1rem">
        <input type="text" id="search-input" placeholder="닉네임 또는 이메일" style="flex:1" />
        <button class="btn-primary btn-sm" id="btn-search">검색</button>
      </div>
      <div id="users-table-wrap">${loader()}</div>`;

    const search = () => loadUsers(el.querySelector('#users-table-wrap'), el.querySelector('#search-input').value, page);
    el.querySelector('#btn-search').addEventListener('click', search);
    el.querySelector('#search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
    loadUsers(el.querySelector('#users-table-wrap'), '', page);
  } catch (e) { el.innerHTML = `<p style="color:var(--color-danger)">${escHtml(e.message)}</p>`; }
}

async function loadUsers(wrap, search, page = 1) {
  wrap.innerHTML = loader();
  try {
    const { items, total, totalPages } = await getUsers({ search, page, size: 20 });
    if (!items.length) { wrap.innerHTML = '<p style="color:var(--color-text-muted)">결과 없음</p>'; return; }
    const rows = items.map((u) => `
      <tr>
        <td>${escHtml(u.nickname)}</td>
        <td>${escHtml(u.email)}</td>
        <td>${u.role}</td>
        <td>${u.followerCount}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td>
          <select class="role-sel" data-id="${u._id}" style="font-size:.75rem;padding:.2rem;width:auto">
            ${['user','popular','admin'].map((r) => `<option ${u.role===r?'selected':''}>${r}</option>`).join('')}
          </select>
          <button class="btn-danger btn-sm" data-ban="${u._id}">정지</button>
        </td>
      </tr>`).join('');
    wrap.innerHTML = `<table class="admin-table"><thead><tr><th>닉네임</th><th>이메일</th><th>권한</th><th>팔로워</th><th>가입일</th><th>액션</th></tr></thead><tbody>${rows}</tbody></table>`;

    wrap.querySelectorAll('.role-sel').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const reason = prompt('사유 (선택)') || '';
        try { await changeRole(sel.dataset.id, sel.value, reason); showToast('권한이 변경됐습니다', 'success'); } catch (e) { showToast(e.message, 'error'); sel.value = sel.dataset.prev; }
      });
      sel.addEventListener('focus', () => { sel.dataset.prev = sel.value; });
    });

    wrap.querySelectorAll('[data-ban]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const reason = prompt('정지 사유');
        if (!reason) return;
        const forceDelete = confirm('강제 탈퇴도 진행하시겠습니까?');
        try { await banUser(btn.dataset.ban, reason, forceDelete); showToast('처리됐습니다', 'success'); loadUsers(wrap, search, page); } catch (e) { showToast(e.message, 'error'); }
      });
    });
  } catch (e) { wrap.innerHTML = `<p style="color:var(--color-danger)">${escHtml(e.message)}</p>`; }
}

async function renderContent(el) {
  el.innerHTML = loader();
  try {
    const { items } = await getPosts({ limit: 50 });
    const rows = items.map((p) => `
      <tr>
        <td>${escHtml(p.title)}</td>
        <td>${escHtml(p.author?.nickname || '탈퇴')}</td>
        <td>${formatDate(p.createdAt)}</td>
        <td>${p.hidden ? '숨김' : '공개'}</td>
        <td>
          <button class="btn-outline btn-sm" data-toggle="${p.id}">${p.hidden ? '공개' : '숨김'}</button>
          <button class="btn-danger btn-sm" data-del="${p.id}">삭제</button>
        </td>
      </tr>`).join('');
    el.innerHTML = `<table class="admin-table"><thead><tr><th>제목</th><th>작성자</th><th>날짜</th><th>상태</th><th>액션</th></tr></thead><tbody>${rows}</tbody></table>`;

    el.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try { await togglePostHidden(btn.dataset.toggle); showToast('처리됐습니다', 'success'); renderContent(el); } catch (e) { showToast(e.message, 'error'); }
      });
    });
    el.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (await showConfirm('게시글을 삭제하시겠습니까?')) {
          try { await adminDeletePost(btn.dataset.del); showToast('삭제됐습니다', 'success'); renderContent(el); } catch (e) { showToast(e.message, 'error'); }
        }
      });
    });
  } catch (e) { el.innerHTML = `<p style="color:var(--color-danger)">${escHtml(e.message)}</p>`; }
}
