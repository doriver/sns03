import { getRoom, joinRoom, leaveRoom, getMessages } from '../api/chat.js';
import { navigate } from '../router.js';
import { getState, getAccessToken } from '../store.js';
import { showToast } from '../components/toast.js';
import { loader } from '../components/loader.js';
import { avatarHtml, escHtml } from '../components/postCard.js';

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function msgHtml(m) {
  const name = escHtml(m.nickname || m.author?.nickname || '');
  const img = avatarHtml(m.profileImage || m.author?.profileImage, 'avatar-sm');
  const content = escHtml(m.content);
  const time = formatTime(m.createdAt);
  return `<div class="chat-msg">
    ${img}
    <div class="chat-msg-body">
      <span class="chat-msg-name">${name}</span>
      <span class="chat-msg-time">${time}</span>
      <p class="chat-msg-content">${content}</p>
    </div>
  </div>`;
}

export async function chatRoomPage(root, { id: roomId }) {
  const user = getState('currentUser');
  if (!user) { navigate('/login'); return; }

  root.innerHTML = loader();

  let room;
  try {
    const data = await joinRoom(roomId);
    if (data.alreadyJoined) {
      // 재입장 — 방 정보만 가져옴
    }
    const roomData = await getRoom(roomId);
    room = roomData.room;
  } catch (e) {
    root.innerHTML = `<p style="color:var(--color-danger)">${escHtml(e.message)}</p>`;
    return;
  }

  const isOwner = String(user.id) === String(room.owner?._id || room.owner?.id);
  const isAdmin = user.role === 'admin';
  const canClose = isOwner || isAdmin;

  root.innerHTML = `
    <div class="chat-room-header">
      <button id="btn-back" class="btn-secondary btn-sm">← 목록</button>
      <div>
        <strong>${escHtml(room.name)}</strong>
        <span id="participant-count" style="margin-left:.5rem;color:var(--color-text-muted)">${room.participantCount} / ${room.capacity}</span>
      </div>
      <div>
        ${canClose ? `<button id="btn-close-room" class="btn-danger btn-sm">방 종료</button>` : ''}
        <button id="btn-leave" class="btn-secondary btn-sm">나가기</button>
      </div>
    </div>
    <div id="msg-area" class="chat-msg-area"></div>
    <div class="chat-input-row">
      <input id="chat-input" type="text" maxlength="500" placeholder="메시지 입력 (Enter 전송)" class="input" style="flex:1">
      <button id="btn-send" class="btn-primary btn-sm">전송</button>
    </div>`;

  const msgArea = root.querySelector('#msg-area');
  const chatInput = root.querySelector('#chat-input');

  // 이전 메시지 로드
  try {
    const { messages } = await getMessages(roomId);
    if (messages.length) {
      msgArea.innerHTML = messages.map(msgHtml).join('');
      msgArea.scrollTop = msgArea.scrollHeight;
    }
  } catch { /* 진행 중 방은 Redis에서, 종료된 방은 Mongo에서 — 에러 무시 */ }

  // WebSocket 연결
  const at = getAccessToken();
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${proto}://${location.host}/ws/chat/${roomId}?token=${encodeURIComponent(at)}`;
  let ws;

  function connectWS() {
    ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === 'message:new') {
        const atBottom = msgArea.scrollHeight - msgArea.scrollTop - msgArea.clientHeight < 50;
        msgArea.insertAdjacentHTML('beforeend', msgHtml(msg.data));
        if (atBottom) msgArea.scrollTop = msgArea.scrollHeight;
      } else if (msg.type === 'presence:update') {
        const el = root.querySelector('#participant-count');
        if (el) el.textContent = `${msg.data.count} / ${room.capacity}`;
      } else if (msg.type === 'room:closed') {
        showToast('채팅방이 종료되었습니다', 'info');
        navigate('/chat');
      }
    };

    ws.onerror = () => {};
    ws.onclose = () => {};
  }

  connectWS();

  function sendMessage() {
    const content = chatInput.value.trim();
    if (!content || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'message:send', content }));
    chatInput.value = '';
  }

  root.querySelector('#btn-send').addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  root.querySelector('#btn-back').addEventListener('click', async () => {
    try { await leaveRoom(roomId); } catch { /* 이미 퇴장 */ }
    ws?.close();
    navigate('/chat');
  });

  root.querySelector('#btn-leave').addEventListener('click', async () => {
    try { await leaveRoom(roomId); } catch (err) { showToast(err.message, 'error'); return; }
    ws?.close();
    navigate('/chat');
  });

  root.querySelector('#btn-close-room')?.addEventListener('click', async () => {
    if (!confirm('채팅방을 종료하시겠습니까? 모든 참가자가 퇴장됩니다.')) return;
    try {
      await import('../api/chat.js').then(({ closeRoom }) => closeRoom(roomId));
      ws?.close();
      navigate('/chat');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 페이지 떠날 때 WS 정리
  const observer = new MutationObserver(() => {
    if (!document.contains(root)) {
      ws?.close();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
