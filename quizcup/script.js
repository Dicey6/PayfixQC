/* ============================================================
   QUIZ CUP — Homepage Script
   ============================================================ */

const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let currentQuiz     = null; /* kept for legacy references */
let countdownTimers = {};   /* { quizId: intervalId } */

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', async () => {
  setupNavToggle();
  setupScrollReveal();
  document.getElementById('caCopyBtn').addEventListener('click', copyCA);

  await Promise.all([
    loadSettings(),
    loadActiveQuiz()
  ]);
});

/* ---- Mobile nav ---- */
function setupNavToggle() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );
}

/* ---- Scroll reveal (IntersectionObserver) ---- */
function setupScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => observer.observe(el));
}

/* ---- Load settings ---- */
async function loadSettings() {
  try {
    const { data } = await db.from('settings').select('*').eq('id', 1).single();
    if (!data) return;

    /* CA */
    if (data.show_ca && data.contract_address) {
      document.getElementById('caAddress').textContent      = data.contract_address;
      document.getElementById('footerCAAddress').textContent = data.contract_address;
      document.getElementById('caSection').classList.remove('hidden');
    } else {
      document.getElementById('caSection').classList.add('hidden');
      document.getElementById('footerCA').classList.add('hidden');
    }

    /* X */
    if (data.x_handle) {
      const xUrl = data.x_url || `https://x.com/${data.x_handle.replace('@', '')}`;
      document.getElementById('xHandle').textContent = `Follow @${data.x_handle.replace('@','')} on X`;
      document.getElementById('xFollowBtn').href     = xUrl;
      document.getElementById('footerXLink').href    = xUrl;
      document.getElementById('navX').textContent    = `𝕏 ${data.x_handle}`;
      document.getElementById('navX').href           = xUrl;
      document.getElementById('navXLink').classList.remove('hidden');
      document.getElementById('xBlock').classList.remove('hidden');
    }
  } catch (err) {
    console.error('Settings error:', err);
  }
}

/* ---- Copy CA ---- */
async function copyCA() {
  const address = document.getElementById('caAddress').textContent;
  if (!address || address === 'Loading...') return;

  try { await navigator.clipboard.writeText(address); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = address; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
  }

  const btn  = document.getElementById('caCopyBtn');
  const icon = document.getElementById('caCopyIcon');
  const text = document.getElementById('caCopyText');
  btn.classList.add('copied');
  btn.style.background = 'linear-gradient(135deg,#00a04c,#007a38)';
  icon.textContent = '✓';
  text.textContent = 'Copied!';
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.style.background = '';
    icon.textContent = '⧉';
    text.textContent = 'Copy Contract Address';
  }, 2200);
}

/* ---- Load active quizzes (all of them) ---- */
async function loadActiveQuiz() {
  const loading   = document.getElementById('quizLoading');
  const empty     = document.getElementById('quizEmpty');
  const container = document.getElementById('quizCardsContainer');

  try {
    const { data, error } = await db
      .from('quizzes')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    loading.classList.add('hidden');
    if (error) throw error;

    if (!data || data.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    /* Use first quiz as currentQuiz for any legacy code */
    currentQuiz = data[0];

    container.innerHTML = data.map(quiz => buildQuizCard(quiz)).join('');

    /* Start countdown timers for each quiz that has a deadline */
    data.forEach(quiz => {
      if (quiz.deadline) startCountdown(quiz.id, quiz.deadline);
    });

  } catch (err) {
    console.error('Quiz load error:', err);
    loading.classList.add('hidden');
    empty.classList.remove('hidden');
  }
}

function buildQuizCard(quiz) {
  const deadlineHtml = quiz.deadline
    ? new Date(quiz.deadline).toLocaleString(undefined, { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : 'Open';

  const countdownHtml = quiz.deadline ? `
    <div class="countdown-wrap" id="countdownWrap-${quiz.id}">
      <p class="countdown-label">Time Remaining</p>
      <div class="countdown">
        <div class="timer-block"><span class="timer-num" id="timerDays-${quiz.id}">00</span><span class="timer-label">Days</span></div>
        <div class="timer-sep">:</div>
        <div class="timer-block"><span class="timer-num" id="timerHrs-${quiz.id}">00</span><span class="timer-label">Hrs</span></div>
        <div class="timer-sep">:</div>
        <div class="timer-block"><span class="timer-num" id="timerMin-${quiz.id}">00</span><span class="timer-label">Min</span></div>
        <div class="timer-sep">:</div>
        <div class="timer-block"><span class="timer-num" id="timerSec-${quiz.id}">00</span><span class="timer-label">Sec</span></div>
      </div>
    </div>` : '';

  return `
    <div class="quiz-card" id="quizCard-${quiz.id}" style="margin-bottom:28px">
      <div class="quiz-card-header">
        <h3>${escapeHtml(quiz.title || 'Current Quiz')}</h3>
        <span class="badge badge-active">🟢 Active</span>
      </div>
      <div class="quiz-card-body">
        <p class="quiz-question">${escapeHtml(quiz.question)}</p>
        ${quiz.description ? `<p class="quiz-description">${escapeHtml(quiz.description)}</p>` : ''}
        <div class="quiz-meta">
          <div class="quiz-meta-item">
            <span class="meta-label">🏆 Reward</span>
            <span class="meta-value">${escapeHtml(quiz.reward || '—')}</span>
          </div>
          <div class="quiz-meta-item">
            <span class="meta-label">⏰ Deadline</span>
            <span class="meta-value deadline-val">${deadlineHtml}</span>
          </div>
        </div>
        ${countdownHtml}
      </div>
      <div class="quiz-form-divider"><span>Submit Your Answer</span></div>
      <div class="quiz-form-body">
        <div id="formAlert-${quiz.id}"></div>
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="username-${quiz.id}" placeholder="YourUsername" maxlength="60" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>Solana Wallet Address</label>
          <input type="text" id="wallet-${quiz.id}" placeholder="Paste your wallet address" maxlength="128" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>Your Answer</label>
          <textarea id="answer-${quiz.id}" placeholder="Type your answer here..." rows="3" maxlength="2000"></textarea>
        </div>
        <button class="btn btn-primary btn-glow w-full" id="submitBtn-${quiz.id}" onclick="submitAnswer(${quiz.id})">
          ⚽ Submit Answer
        </button>
        <div id="submitSuccess-${quiz.id}" class="hidden" style="margin-top:14px">
          <div class="alert alert-success">
            ✅ Submitted! Waiting for admin review.<br />
            <a href="status.html" style="color:inherit;font-size:0.85rem;opacity:0.85;text-decoration:underline;">Track your status →</a>
          </div>
        </div>
      </div>
    </div>`;
}

/* ---- Countdown timer (per quiz) ---- */
function startCountdown(quizId, deadline) {
  const wrap   = document.getElementById(`countdownWrap-${quizId}`);
  const daysEl = document.getElementById(`timerDays-${quizId}`);
  const hrsEl  = document.getElementById(`timerHrs-${quizId}`);
  const minEl  = document.getElementById(`timerMin-${quizId}`);
  const secEl  = document.getElementById(`timerSec-${quizId}`);

  if (!wrap || !daysEl) return;

  if (countdownTimers[quizId]) clearInterval(countdownTimers[quizId]);

  function setDigit(el, val) {
    const str = String(val).padStart(2, '0');
    if (el.textContent !== str) {
      el.style.animation = 'none';
      el.textContent = str;
      void el.offsetWidth;
      el.style.animation = 'countUp 0.25s ease';
    }
  }

  function tick() {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) {
      clearInterval(countdownTimers[quizId]);
      wrap.innerHTML = '<p class="timer-expired" style="text-align:center;padding:12px 0">⏰ Quiz has ended</p>';
      return;
    }
    setDigit(daysEl, Math.floor(diff / 86400000));
    setDigit(hrsEl,  Math.floor((diff % 86400000) / 3600000));
    setDigit(minEl,  Math.floor((diff % 3600000)  / 60000));
    setDigit(secEl,  Math.floor((diff % 60000)    / 1000));
  }

  tick();
  countdownTimers[quizId] = setInterval(tick, 1000);
}

/* ---- Submit answer (per quiz) ---- */
async function submitAnswer(quizId) {
  const btn       = document.getElementById(`submitBtn-${quizId}`);
  const alertDiv  = document.getElementById(`formAlert-${quizId}`);
  const successEl = document.getElementById(`submitSuccess-${quizId}`);

  const username = document.getElementById(`username-${quizId}`).value.trim();
  const wallet   = document.getElementById(`wallet-${quizId}`).value.trim();
  const answer   = document.getElementById(`answer-${quizId}`).value.trim();

  alertDiv.innerHTML = '';
  successEl.classList.add('hidden');

  if (!username) return showFormError(quizId, 'Please enter your username.');
  if (!wallet)   return showFormError(quizId, 'Please enter your wallet address.');
  if (!answer)   return showFormError(quizId, 'Please write your answer.');

  btn.disabled    = true;
  btn.textContent = 'Submitting...';

  try {
    const { data: existing } = await db
      .from('submissions')
      .select('id')
      .ilike('wallet', wallet)
      .eq('quiz_id', quizId)
      .maybeSingle();

    if (existing) {
      showFormError(quizId, 'This wallet has already submitted for this quiz.');
      return;
    }

    const { error } = await db.from('submissions').insert({
      quiz_id:  quizId,
      username: username,
      wallet:   wallet,
      answer:   answer,
      status:   'pending'
    });

    if (error) throw error;

    document.getElementById(`username-${quizId}`).value = '';
    document.getElementById(`wallet-${quizId}`).value   = '';
    document.getElementById(`answer-${quizId}`).value   = '';
    successEl.classList.remove('hidden');
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (err) {
    showFormError(quizId, 'Submission failed. Please try again.');
    console.error('Submit error:', err);
  } finally {
    btn.disabled    = false;
    btn.textContent = '⚽ Submit Answer';
  }
}

function showFormError(quizId, msg) {
  const alertDiv = document.getElementById(`formAlert-${quizId}`);
  if (!alertDiv) return;
  alertDiv.innerHTML = `<div class="alert alert-error">${msg}</div>`;
  alertDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
