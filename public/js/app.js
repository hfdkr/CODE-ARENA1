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
// ══ BOOT APP ═════════════════════════════════════════
async function bootApp() {
  if (!state.token) {
    $('auth-screen').style.display=''; $('app').classList.add('hidden');
    return;
  }
  // Verify token
  const me = await req('/me');
  if (!me.success) { clearAuth(); bootApp(); return; }
  state.user = me.user;
  localStorage.setItem('ca_user', JSON.stringify(state.user));

  $('auth-screen').style.display='none';
  $('app').classList.remove('hidden');

  // Sidebar user
  $('sb-name').textContent  = state.user.name;
  $('sb-role').textContent  = state.user.role === 'admin' ? '👑 Admin' : '👤 Member';
  $('sb-avatar').textContent = state.user.name[0].toUpperCase();

  // Admin nav
  if (state.user.role === 'admin') $('admin-nav-link').style.display='';
  else $('admin-nav-link').style.display='none';

  // Load home
  const [cats, settings] = await Promise.all([req('/categories'), req('/settings')]);
  state.categories = cats; state.settings = settings;

  initHome();
  navigate('home');
  startHeartbeat();
  loadPresence();
}

// ══ HEARTBEAT ════════════════════════════════════════
function startHeartbeat() {
  stopHeartbeat();
  req('/heartbeat','POST');
  state._heartbeat = setInterval(() => req('/heartbeat','POST'), 30000);
}
function stopHeartbeat() { if(state._heartbeat){clearInterval(state._heartbeat);state._heartbeat=null;} }

async function loadPresence() {
  if (!state.token) return;
  const r = await req('/presence');
  if (!r.success) return;
  const list = $('presence-list');
  if (!list) return;
  list.innerHTML = r.users.map(u => `
    <div class="presence-item">
      <span class="p-dot ${u.online?'p-online':'p-offline'}"></span>
      <span class="p-name">${esc(u.name)}</span>
      <span class="p-role">${u.role==='admin'?'👑':''}</span>
    </div>
  `).join('');
  setTimeout(loadPresence, 30000);
}

// ══ ROUTER ═══════════════════════════════════════════
function navigate(page, data=null) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = $(`page-${page}`);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-item[data-page]').forEach(l => l.classList.toggle('active', l.dataset.page === page));

  const hooks = {
    home:()=>{},
    quiz: startQuiz,
    score: showScore,
    lessons: initLessons,
    'lesson-detail': ()=>initLessonDetail(data),
    leaderboard: initLeaderboard,
    admin: initAdmin
  };
  if (hooks[page]) hooks[page]();
  window.scrollTo(0,0);
}
window.navigate = navigate;

// ── Sidebar toggle ─────────────────────────────────
function toggleSidebar() {
  const sb = $('sidebar');
  sb.classList.toggle('collapsed');
  localStorage.setItem('ca_sidebar', sb.classList.contains('collapsed')?'1':'0');
}
window.toggleSidebar = toggleSidebar;

// ══ HOME ═════════════════════════════════════════════
function initHome() {
  const cats     = state.categories;
  const settings = state.settings;

  $('stat-q').textContent = cats.reduce((a,c) => a+(c.questionCount||0), 0);
  $('stat-l').textContent = cats.reduce((a,c) => a+(c.lessonCount||0), 0);
  $('stat-c').textContent = cats.length;

  const grid = $('categoryGrid');
  grid.innerHTML = '';
  cats.forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.className = 'cat-pill' + (i===0?' active':'');
    btn.dataset.id = cat.id;
    btn.innerHTML  = `${cat.icon||''} ${esc(cat.name)}`;
    btn.onclick    = () => {
      document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.quiz.category = cat.id;
      checkLaunch();
    };
    grid.appendChild(btn);
  });
  if (cats.length) { state.quiz.category = cats[0].id; checkLaunch(); }

  document.querySelectorAll('.diff-btn').forEach(b => b.onclick = () => {
    document.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); state.quiz.difficulty = b.dataset.diff;
  });
  document.querySelectorAll('.mode-btn').forEach(b => b.onclick = () => {
    document.querySelectorAll('.mode-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); state.quiz.mode = b.dataset.mode;
  });

  $('launchBtn').onclick = () => navigate('quiz');
}

function checkLaunch() { $('launchBtn').disabled = !state.quiz.category; }


// ══ QUIZ ═════════════════════════════════════════════
async function startQuiz() {
  const q = state.quiz;
  q.current=0; q.score=0; q.answers=[]; q.answered=false;
  clearInterval(q.timerInterval);
  const data = await req(`/quiz?categoryId=${q.category}&difficulty=${q.difficulty}`);
  if (!data.questions?.length) { alert('Aucune question pour cette sélection !'); navigate('home'); return; }
  q.questions = data.questions;
  if (data.settings) state.settings = {...state.settings,...data.settings};
  q.timePerQ = q.mode==='challenge' ? (state.settings.challengeTimePerQuestion||15) : (state.settings.timePerQuestion||30);

  $('q-cat-tag').textContent  = state.categories.find(c=>c.id===q.category)?.name || q.category;
  $('q-diff-tag').textContent = q.difficulty==='easy'?'Facile':'Moyen';
  q.mode==='challenge' ? show('q-mode-tag') : hide('q-mode-tag');
  $('q-skip').onclick = handleSkip;
  loadQ();
}

function loadQ() {
  const q = state.quiz, question = q.questions[q.current], total = q.questions.length;
  $('q-score').textContent   = q.score + ' pts';
  $('q-tracker').textContent = `Q ${q.current+1}/${total}`;
  $('q-progress-bar').style.width = ((q.current+1)/total*100)+'%';
  $('q-question').textContent = question.question;
  const opts = $('q-options'); opts.innerHTML='';
  question.options.forEach((opt,idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<div class="option-letter">${String.fromCharCode(65+idx)}</div><span class="option-text">${esc(opt)}</span>`;
    btn.dataset.opt = opt;
    btn.onclick = () => { if(!q.answered) handleAnswer(opt, btn); };
    opts.appendChild(btn);
  });
  startTimer();
}
