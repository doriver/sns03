import { login } from '../api/auth.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

export async function loginPage(root) {
  root.innerHTML = `
    <div class="auth-form">
      <div class="card">
        <h2>로그인</h2>
        <form id="login-form">
          <div class="form-group"><label>이메일</label><input type="email" name="email" required /></div>
          <div class="form-group"><label>비밀번호</label><input type="password" name="password" required /></div>
          <div id="form-err" class="form-error"></div>
          <button class="btn-primary" style="width:100%;margin-top:.5rem" type="submit">로그인</button>
        </form>
        <p style="text-align:center;margin-top:1rem;font-size:.875rem">계정이 없으신가요? <a href="/signup" data-link>회원가입</a></p>
      </div>
    </div>`;

  root.querySelector('[data-link]').addEventListener('click', (e) => { e.preventDefault(); navigate('/signup'); });

  root.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = root.querySelector('#form-err');
    try {
      await login({ email: fd.get('email'), password: fd.get('password') });
      const params = new URLSearchParams(location.search);
      navigate(params.get('redirect') || '/');
    } catch (err) {
      errEl.textContent = err.message || '로그인에 실패했습니다';
    }
  });
}
