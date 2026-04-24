export function showConfirm(message, title = '확인') {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-box">
          <h3>${title}</h3>
          <p>${message}</p>
          <div class="modal-actions">
            <button class="btn-outline" id="modal-cancel">취소</button>
            <button class="btn-danger" id="modal-confirm">확인</button>
          </div>
        </div>
      </div>`;
    root.querySelector('#modal-cancel').onclick = () => { root.innerHTML = ''; resolve(false); };
    root.querySelector('#modal-confirm').onclick = () => { root.innerHTML = ''; resolve(true); };
    root.querySelector('.modal-overlay').onclick = (e) => { if (e.target === e.currentTarget) { root.innerHTML = ''; resolve(false); } };
  });
}
