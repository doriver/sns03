import { createPost, updatePost, getPost } from '../api/posts.js';
import { loader } from '../components/loader.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';
import { escHtml } from '../components/postCard.js';

export async function postEditorPage(root, params) {
  const editId = params?.id;
  let existingImages = [];

  if (editId) {
    root.innerHTML = loader();
    try {
      const { post } = await getPost(editId);
      existingImages = post.images || [];
      render(root, post, editId, existingImages);
    } catch (e) {
      root.innerHTML = `<p style="color:var(--color-danger)">${escHtml(e.message)}</p>`;
    }
  } else {
    render(root, null, null, []);
  }
}

function render(root, post, editId, existingImages) {
  let pendingFiles = [];
  let removeImages = [];

  root.innerHTML = `
    <h2 class="page-title">${editId ? '글 수정' : '글쓰기'}</h2>
    <div class="card">
      <form id="post-form">
        <div class="form-group">
          <label>제목</label>
          <input type="text" name="title" maxlength="100" required value="${escHtml(post?.title || '')}" />
        </div>
        <div class="form-group">
          <label>내용</label>
          <textarea name="content" maxlength="5000" rows="10" required>${escHtml(post?.content || '')}</textarea>
        </div>
        <div class="form-group">
          <label>이미지 (최대 3장, jpg/png/webp, 5MB)</label>
          <div class="drop-zone" id="drop-zone">파일을 끌어다 놓거나 클릭하여 선택</div>
          <input type="file" id="file-input" accept="image/jpeg,image/png,image/webp" multiple style="display:none" />
          <div class="img-preview-list" id="img-preview"></div>
        </div>
        <div id="form-err" class="form-error"></div>
        <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem">
          <button type="button" class="btn-outline" id="btn-cancel">취소</button>
          <button type="submit" class="btn-primary">${editId ? '수정' : '등록'}</button>
        </div>
      </form>
    </div>`;

  root.querySelector('#btn-cancel').addEventListener('click', () => navigate(editId ? `/posts/${editId}` : '/posts'));

  const dropZone = root.querySelector('#drop-zone');
  const fileInput = root.querySelector('#file-input');
  const previewEl = root.querySelector('#img-preview');

  function renderPreviews() {
    previewEl.innerHTML = '';
    existingImages.filter((u) => !removeImages.includes(u)).forEach((url) => {
      const item = document.createElement('div');
      item.className = 'img-preview-item';
      item.innerHTML = `<img src="${escHtml(url)}" /><button type="button" data-url="${escHtml(url)}">✕</button>`;
      item.querySelector('button').addEventListener('click', () => { removeImages.push(url); renderPreviews(); });
      previewEl.appendChild(item);
    });
    pendingFiles.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'img-preview-item';
      const url = URL.createObjectURL(f);
      item.innerHTML = `<img src="${url}" /><button type="button">✕</button>`;
      item.querySelector('button').addEventListener('click', () => { pendingFiles.splice(i, 1); renderPreviews(); });
      previewEl.appendChild(item);
    });
  }

  function addFiles(files) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const total = existingImages.filter((u) => !removeImages.includes(u)).length + pendingFiles.length;
    for (const f of files) {
      if (!allowed.includes(f.type)) { showToast('jpg, png, webp만 업로드 가능합니다', 'error'); continue; }
      if (f.size > 5 * 1024 * 1024) { showToast('파일 크기는 5MB 이하이어야 합니다', 'error'); continue; }
      if (total + pendingFiles.length >= 3) { showToast('최대 3장까지 업로드 가능합니다', 'error'); break; }
      pendingFiles.push(f);
    }
    renderPreviews();
  }

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { addFiles(Array.from(fileInput.files)); fileInput.value = ''; });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); addFiles(Array.from(e.dataTransfer.files)); });

  renderPreviews();

  root.querySelector('#post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = root.querySelector('#form-err');
    const fd = new FormData(e.target);
    pendingFiles.forEach((f) => fd.append('images', f));
    if (editId) {
      removeImages.forEach((u) => fd.append('removeImages', u));
    }
    try {
      if (editId) {
        await updatePost(editId, fd);
        showToast('수정됐습니다', 'success');
        navigate(`/posts/${editId}`);
      } else {
        const { post } = await createPost(fd);
        showToast('게시됐습니다', 'success');
        navigate(`/posts/${post.id || post._id}`);
      }
    } catch (err) { errEl.textContent = err.message; }
  });
}
