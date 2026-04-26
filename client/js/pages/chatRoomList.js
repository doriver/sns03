import { getRooms, createRoom, closeRoom } from '../api/chat.js';
import { navigate } from '../router.js';
import { getState, getAccessToken } from '../store.js';
import { showToast } from '../components/toast.js';
import { loader } from '../components/loader.js';
import { avatarHtml, escHtml } from '../components/postCard.js';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function roomRow(room, user) {
  const isOwner = user && String(user.id) === String(room.owner?._id || room.owner?.id);
  const isAdmin = user?.role === 'admin';
  const canClose = isOwner || isAdmin;
  const canCreate = user && (user.role === 'popular' || user.role === 'admin');
  return `
    <div class="chat-room-row" data-id="${escHtml(String(room.id))}">
      <div class="chat-room-info">
        ${avatarHtml(room.owner?.profileImage, 'avatar-sm')}
        <div class="chat-room-text">
          <span class="chat-room-name">${escHtml(room.name)}</span>
          <span class="chat-room-owner">${escHtml(room.owner?.nickname || '')}</span>
        </div>
      </div>
      <div class="chat-room-meta">
        <span class="chat-room-count">${room.participantCount} / ${room.capacity}</span>
        <span class="chat-room-date">${formatDate(room.createdAt)}</span>
        ${canClose ? `<button class="btn-danger btn-sm btn-close-room" data-id="${escHtml(String(room.id))}">종료</button>` : ''}
        <button class="btn-primary btn-sm btn-enter-room" data-id="${escHtml(String(room.id))}">입장</button>
      </div>
    </div>`;
}

export async function chatRoomListPage(root) {
  const user = getState('currentUser');
  const canCreate = user && (user.role === 'popular' || user.role === 'admin');

  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 class="page-title" style="margin:0">단체 채팅</h2>
      ${canCreate ? `<button class="btn-primary btn-sm" id="btn-create-room">방 만들기</button>` : ''}
    </div>
    <div id="room-list-loader"></div>
    <div id="room-list" class="card" style="padding:0;overflow:hidden"></div>
    <div id="pagination" class="pagination"></div>

    <div id="create-room-modal" class="modal-backdrop" style="display:none">
      <div class="modal">
        <h3>채팅방 만들기</h3>
        <div class="form-group">
          <label>방 이름 (1~30자)</label>
          <input id="input-room-name" type="text" maxlength="30" placeholder="방 이름" class="input">
        </div>
        <div class="form-group">
          <label>최대 인원 (2~50)</label>
          <input id="input-capacity" type="number" min="2" max="50" value="10" class="input">
        </div>
        <div class="form-group">
          <label>설명 (선택)</label>
          <textarea id="input-description" maxlength="200" rows="2" class="input" placeholder="설명"></textarea>
        </div>
        <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem">
          <button id="btn-modal-cancel" class="btn-secondary btn-sm">취소</button>
          <button id="btn-modal-submit" class="btn-primary btn-sm">만들기</button>
        </div>
      </div>
    </div>`;

  let currentPage = 1;
  let totalPages = 1;
  let currentSort = 'createdAt';
  let sseSource = null;

  const listEl = root.querySelector('#room-list');
  const loaderEl = root.querySelector('#room-list-loader');
  const paginationEl = root.querySelector('#pagination');

  async function loadPage(pageNum) {
    loaderEl.innerHTML = loader();
    try {
      const result = await getRooms({ page: pageNum, limit: 20, sort: currentSort });
      currentPage = result.page;
      totalPages = result.totalPages;

      if (!result.items.length) {
        listEl.innerHTML = '<p style="padding:1.5rem;color:var(--color-text-muted);text-align:center">활성 채팅방이 없습니다.</p>';
      } else {
        listEl.innerHTML = result.items.map((r) => roomRow(r, user)).join('');
        attachRowEvents();
      }
      renderPagination();
    } catch (e) {
      listEl.innerHTML = `<p style="padding:1.5rem;color:var(--color-danger);text-align:center">${escHtml(e.message)}</p>`;
    } finally {
      loaderEl.innerHTML = '';
    }
  }

  function attachRowEvents() {
    listEl.querySelectorAll('.btn-enter-room').forEach((btn) => {
      btn.addEventListener('click', () => navigate(`/chat/${btn.dataset.id}`));
    });
    listEl.querySelectorAll('.btn-close-room').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('채팅방을 종료하시겠습니까?')) return;
        try {
          await closeRoom(btn.dataset.id);
          showToast('채팅방이 종료되었습니다', 'info');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  function renderPagination() {
    if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }
    let html = `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">이전</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">다음</button>`;
    paginationEl.innerHTML = html;
    paginationEl.querySelectorAll('button[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => loadPage(Number(btn.dataset.page)));
    });
  }

  function connectSSE() {
    const at = getAccessToken();
    if (!at) return;
    sseSource = new EventSource(`/api/chat/rooms/stream`, { withCredentials: true });

    sseSource.addEventListener('room:created', () => loadPage(currentPage));
    sseSource.addEventListener('room:closed', () => loadPage(currentPage));
    sseSource.addEventListener('room:participant-changed', () => loadPage(currentPage));
    sseSource.onerror = () => {
      sseSource.close();
      setTimeout(connectSSE, 5000);
    };
  }

  // 방 만들기 모달
  const modal = root.querySelector('#create-room-modal');
  root.querySelector('#btn-create-room')?.addEventListener('click', () => {
    modal.style.display = 'flex';
  });
  root.querySelector('#btn-modal-cancel')?.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  root.querySelector('#btn-modal-submit')?.addEventListener('click', async () => {
    const name = root.querySelector('#input-room-name').value.trim();
    const capacity = parseInt(root.querySelector('#input-capacity').value, 10);
    const description = root.querySelector('#input-description').value.trim();
    if (!name) { showToast('방 이름을 입력하세요', 'error'); return; }
    try {
      await createRoom({ name, capacity, description });
      modal.style.display = 'none';
      showToast('채팅방이 생성되었습니다', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  await loadPage(1);
  connectSSE();

  // 페이지 떠날 때 SSE 닫기
  const observer = new MutationObserver(() => {
    if (!document.contains(root)) {
      sseSource?.close();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
