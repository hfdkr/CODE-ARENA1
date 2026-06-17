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


function startTimer() {
  const q = state.quiz;
  q.answered=false; q.timeLeft=q.timePerQ;
  clearInterval(q.timerInterval);
  const timer=$('q-timer');
  timer.className = 'timer' + (q.mode==='challenge'?' danger':'');
  const tick = () => {
    timer.textContent = q.timeLeft;
    if(q.timeLeft<=5 && q.mode!=='challenge') timer.className='timer danger';
    if(q.timeLeft<=0){clearInterval(q.timerInterval);handleTimeout();}
    q.timeLeft--;
  };
  tick();
  q.timerInterval = setInterval(tick,1000);
}

function handleAnswer(sel, btn) {
  const q=state.quiz; if(q.answered)return;
  q.answered=true; clearInterval(q.timerInterval);
  const question=q.questions[q.current], ok=sel===question.answer;
  if(ok){q.score+=(state.settings.pointsPerQuestion||10);btn.classList.add('correct');}
  else {
    btn.classList.add('wrong');
    document.querySelectorAll('.option-btn').forEach(b=>{if(b.dataset.opt===question.answer)b.classList.add('correct');});
  }
  document.querySelectorAll('.option-btn').forEach(b=>b.disabled=true);
  q.answers.push({question:question.question,selected:sel,correct:question.answer,isCorrect:ok});
  $('q-score').textContent=q.score+' pts';
  setTimeout(()=>advanceQ(),1500);
}

function handleTimeout() {
  const q=state.quiz; if(q.answered)return;
  q.answered=true;
  const question=q.questions[q.current];
  q.answers.push({question:question.question,selected:null,correct:question.answer,isCorrect:false});
  document.querySelectorAll('.option-btn').forEach(b=>{if(b.dataset.opt===question.answer)b.classList.add('correct');b.disabled=true;});
  setTimeout(()=>advanceQ(),1500);
}

function handleSkip() {
  const q=state.quiz; if(q.answered)return;
  q.answered=true; clearInterval(q.timerInterval);
  const question=q.questions[q.current];
  q.answers.push({question:question.question,selected:null,correct:question.answer,isCorrect:false});
  advanceQ();
}

function advanceQ() {
  const q=state.quiz;
  if(q.current<q.questions.length-1){q.current++;loadQ();}else{endQuiz();}
}

function endQuiz() {
  clearInterval(state.quiz.timerInterval);
  state.quizResult={score:state.quiz.score,answers:state.quiz.answers,category:state.quiz.category,difficulty:state.quiz.difficulty,mode:state.quiz.mode};
  navigate('score');
}


// ══ SCORE ════════════════════════════════════════════
async function showScore() {
  const r=state.quizResult; if(!r){navigate('home');return;}
  const total=r.answers.length, correct=r.answers.filter(a=>a.isCorrect).length,
        wrong=r.answers.filter(a=>!a.isCorrect&&a.selected!==null).length,
        skipped=r.answers.filter(a=>a.selected===null).length,
        pct=total>0?Math.round((r.score/(total*(state.settings.pointsPerQuestion||10)))*100):0;

  let emoji='📚',title='Continuez !',msg='Entraîne-toi encore.';
  if(pct>=80){emoji='🔥';title='Excellent !';msg='Tu maîtrises le sujet !';}
  else if(pct>=60){emoji='⭐';title='Bien joué !';msg='Tu progresses bien.';}
  else if(pct>=40){emoji='💡';title='Pas mal !';msg='Continue, tu y arrives !';}

  $('s-emoji').textContent=emoji; $('s-title').textContent=title; $('s-msg').textContent=msg;
  $('s-pct').textContent=pct+'%'; $('s-correct').textContent=correct;
  $('s-wrong').textContent=wrong; $('s-skip').textContent=skipped; $('s-pts').textContent=r.score;

  const circ=2*Math.PI*54;
  setTimeout(()=>{ $('ring-fill').style.strokeDashoffset=circ-(pct/100)*circ; },100);

  // Auto-save score
  hide('s-saved-msg');
  const saved = await req('/scores','POST',{categoryId:r.category,difficulty:r.difficulty,score:r.score,percentage:pct,correct,incorrect:wrong,skipped,mode:r.mode});
  if(saved.id) show('s-saved-msg');

  $('s-replay').onclick = ()=>navigate('quiz');
}



// ══ LESSONS ══════════════════════════════════════════
async function initLessons() {
  const [lessons, cats] = await Promise.all([req('/lessons'), req('/categories')]);
  const filter = $('lessons-filter');
  filter.innerHTML = '<button class="filter-chip active" data-cat="">Tout</button>';
  cats.forEach(c => {
    const b=document.createElement('button'); b.className='filter-chip'; b.dataset.cat=c.id;
    b.textContent=(c.icon||'')+' '+c.name; filter.appendChild(b);
  });
  let activeCat='';
  filter.onclick = e => {
    const b=e.target.closest('.filter-chip'); if(!b)return;
    filter.querySelectorAll('.filter-chip').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); activeCat=b.dataset.cat;
    renderLessons(lessons,cats,activeCat);
  };
  renderLessons(lessons,cats,activeCat);
}

function renderLessons(lessons,cats,filterCat) {
  const grid=$('lessons-grid');
  const filtered=filterCat?lessons.filter(l=>l.categoryId===filterCat):lessons;
  if(!filtered.length){grid.innerHTML='<p style="color:var(--text2)">Aucune leçon disponible.</p>';return;}
  grid.innerHTML=filtered.map(l=>{
    const cat=cats.find(c=>c.id===l.categoryId);
    return `<div class="lesson-card" data-id="${l.id}">
      <div class="lesson-card-cat">${esc(cat?(cat.icon+' '+cat.name):l.categoryId)}</div>
      <div class="lesson-card-title">${esc(l.title)}</div>
      <div class="lesson-card-diff">${l.difficulty==='easy'?'🟢 Facile':'🟠 Moyen'}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.lesson-card').forEach(card=>{
    card.onclick=()=>navigate('lesson-detail',card.dataset.id);
  });
}

async function initLessonDetail(id) {
  if(!id){navigate('lessons');return;}
  const lesson=await req('/lessons/'+id);
  const cats=state.categories.length?state.categories:await req('/categories');
  const cat=cats.find(c=>c.id===lesson.categoryId);
  $('lesson-content').innerHTML=`
    <h1>${esc(lesson.title)}</h1>
    <div class="lesson-meta">${cat?cat.icon+' '+esc(cat.name):''} · ${lesson.difficulty==='easy'?'🟢 Facile':'🟠 Moyen'} · ${new Date(lesson.createdAt).toLocaleDateString('fr-FR')}</div>
    <div class="lesson-body">${md2html(lesson.content)}</div>
  `;
}



// ══ LEADERBOARD ══════════════════════════════════════
async function initLeaderboard() {
  const [scores,cats]=await Promise.all([req('/scores'),req('/categories')]);
  const filter=$('lb-filter');
  filter.innerHTML='<button class="filter-chip active" data-cat="">Tout</button>';
  cats.forEach(c=>{const b=document.createElement('button');b.className='filter-chip';b.dataset.cat=c.id;b.textContent=(c.icon||'')+' '+c.name;filter.appendChild(b);});
  let ac='';
  filter.onclick=e=>{const b=e.target.closest('.filter-chip');if(!b)return;filter.querySelectorAll('.filter-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');ac=b.dataset.cat;renderLB(scores,cats,ac);};
  renderLB(scores,cats,ac);
}

function renderLB(scores,cats,fc) {
  const filtered=(fc?scores.filter(s=>s.categoryId===fc):scores).sort((a,b)=>b.score-a.score);
  $('lb-body').innerHTML=filtered.map((s,i)=>{
    const cat=cats.find(c=>c.id===s.categoryId), rank=i+1;
    const rc=rank<=3?`rank-${rank}`:'rank-n';
    return `<tr>
      <td><span class="rank-badge ${rc}">${rank<=3?['🥇','🥈','🥉'][rank-1]:rank}</span></td>
      <td><strong>${esc(s.playerName)}</strong></td>
      <td>${cat?cat.icon+' '+esc(cat.name):esc(s.categoryId)}</td>
      <td><span class="mode-badge mode-${s.mode}">${s.mode==='challenge'?'⚡ Challenge':'▶ Normal'}</span></td>
      <td style="font-family:var(--mono);color:var(--blue);font-weight:700">${s.score}</td>
      <td style="font-family:var(--mono)">${s.percentage}%</td>
      <td style="color:var(--text2);font-size:.8rem">${new Date(s.createdAt).toLocaleDateString('fr-FR')}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:30px">Aucun score.</td></tr>';
}
