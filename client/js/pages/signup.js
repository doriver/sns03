import { signup } from '../api/auth.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

export async function signupPage(root) {
  root.innerHTML = `
    <div class="auth-form">
      <div class="card">
        <h2>회원가입</h2>
        <form id="signup-form">
          <div class="form-group"><label>이메일</label><input type="email" name="email" required /></div>
          <div class="form-group"><label>닉네임</label><input type="text" name="nickname" minlength="2" maxlength="20" required /></div>
          <div class="form-group"><label>비밀번호</label><input type="password" name="password" minlength="8" required /></div>
          <div id="form-err" class="form-error"></div>
          <button class="btn-primary" style="width:100%;margin-top:.5rem" type="submit">가입하기</button>
        </form>
        <p style="text-align:center;margin-top:1rem;font-size:.875rem">이미 계정이 있으신가요? <a href="/login" data-link>로그인</a></p>
      </div>
    </div>`;

  root.querySelector('[data-link]').addEventListener('click', (e) => { e.preventDefault(); navigate('/login'); });

  root.querySelector('#signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = root.querySelector('#form-err');
    try {
      await signup({ email: fd.get('email'), password: fd.get('password'), nickname: fd.get('nickname') });
      showToast('가입이 완료됐습니다. 로그인해주세요.', 'success');
      navigate('/login');
    } catch (err) {
      if (err.details?.length) {
        errEl.textContent = err.details.map((d) => d.message).join(', ');
      } else {
        errEl.textContent = err.message || '가입에 실패했습니다';
      }
    }
  });
}
