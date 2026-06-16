// ══ AUTH ═════════════════════════════════════════════
function switchTab(tab) {
  $('form-signin').style.display = tab === 'signin' ? '' : 'none';
  $('form-signup').style.display = tab === 'signup' ? '' : 'none';
  $('tab-signin').classList.toggle('active', tab === 'signin');
  $('tab-signup').classList.toggle('active', tab === 'signup');
  $('auth-subtitle').textContent = tab === 'signin' ? "Welcome back — sign in to continue" : "Create your free CodeArena account";
  hide('si-error'); hide('su-error');
}
window.switchTab = switchTab;

function togglePwd(id, btn) {
  const inp = $(id);
  const eye = btn.querySelector('i');
  if (inp.type === 'password') { inp.type='text'; eye.className='fi fi-rr-eye-crossed'; }
  else { inp.type='password'; eye.className='fi fi-rr-eye'; }
}
window.togglePwd = togglePwd;

function updateStrength(val) {
  const fills = ['strength-fill','strength-fill2'];
  let s=0, cls='', label='';
  if (val.length >= 6) s=1;
  if (val.length >= 8 && /[A-Z]/.test(val)) s=2;
  if (s===2 && /[^a-zA-Z0-9]/.test(val)) s=3;
  if (s===0){cls='#f85149';label='Too short';}
  else if (s===1){cls='#f59e0b';label='Weak';}
  else if (s===2){cls='#10b981';label='Good';}
  else {cls='#4ade80';label='Strong';}
  fills.forEach(fid => { const f=$(fid); if(f){f.style.width=(s/3*100)+'%';f.style.background=cls;} });
  const l=$('strength-label'); if(l) l.textContent=label;
}
window.updateStrength = updateStrength;

async function handleSignIn() {
  const email=$('si-email').value.trim(), pass=$('si-password').value;
  hide('si-error');
  const r = await req('/login','POST',{email,password:pass});
  if (r.success) { saveAuth(r.token, r.user); bootApp(); }
  else { showErr('si-error', r.message||'Login failed'); }
}
window.handleSignIn = handleSignIn;

async function handleSignUp() {
  const name=$('su-name').value.trim(), email=$('su-email').value.trim(),
        pass=$('su-password').value, sq=$('su-sq').value, sa=$('su-sa').value.trim();
  hide('su-error');
  const r = await req('/register','POST',{name,email,password:pass,securityQuestion:sq,securityAnswer:sa});
  if (r.success) { saveAuth(r.token, r.user); bootApp(); }
  else { showErr('su-error', r.message||'Registration failed'); }
}
window.handleSignUp = handleSignUp;

// ── Forgot Password ────────────────────────────────
let _fpToken = null;
window.openForgot  = () => { showModal('forgot-modal'); $('fp-email').value=''; $('fp-answer')&&($('fp-answer').value=''); hide('fp-error'); $('fp-q-block').style.display='none'; $('fp-step1').style.display=''; $('fp-step2').style.display='none'; };
window.closeForgot = () => hideModal('forgot-modal');

window.loadSecQ = async () => {
  const email = $('fp-email').value.trim();
  hide('fp-error');
  const r = await req('/forgot-password/question?email='+encodeURIComponent(email));
  if (r.success) { $('fp-q-text').textContent = r.question; $('fp-q-block').style.display=''; }
  else { showErr('fp-error', r.message||'Not found'); }
};

window.verifySecQ = async () => {
  const email=$('fp-email').value.trim(), answer=$('fp-answer').value.trim();
  hide('fp-error');
  const r = await req('/forgot-password/verify','POST',{email,answer});
  if (r.success) { _fpToken=r.token; $('fp-step1').style.display='none'; $('fp-step2').style.display=''; }
  else { showErr('fp-error', r.message||'Wrong answer'); }
};

window.doReset = async () => {
  const np=$('fp-newpwd').value, cp=$('fp-confirm').value;
  hide('fp-reset-error');
  if (np !== cp) return showErr('fp-reset-error','Passwords do not match');
  const r = await req('/forgot-password/reset','POST',{token:_fpToken,newPassword:np});
  if (r.success) { hideModal('forgot-modal'); switchTab('signin'); }
  else { showErr('fp-reset-error', r.message||'Reset failed'); }
};