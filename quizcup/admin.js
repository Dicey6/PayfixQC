/* ============================================================
   QUIZ CUP — Admin Script (admin.js)
   ============================================================ */

/* ---- Init Supabase ---- */
const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

/* ============================================================
   TOAST NOTIFICATION SYSTEM
   Usage: showToast('Message', 'success'|'error'|'info'|'warn', durationMs)
============================================================ */
const TOAST_ICONS = { success: '✅', error: '❌', info: '⚡', warn: '⚠️' };
const TOAST_TITLES = { success: 'Success', error: 'Error', info: 'Info', warn: 'Warning' };

function showToast(msg, type = 'info', duration = 6000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${TOAST_TITLES[type] || type}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('visible')));

  if (duration > 0) {
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 320);
    }, duration);
  }
  return toast;
}

/* ============================================================
   ERROR DECODER
   Translates raw errors into plain English
============================================================ */
function decodeError(err) {
  const raw = (err?.message || err?.error || String(err) || '').toLowerCase();

  /* ---- Supabase / DB ---- */
  if (raw.includes('jwt') || raw.includes('invalid api key'))
    return 'Supabase auth error — your anon key may be wrong in config.js';
  if (raw.includes('relation') || raw.includes('does not exist'))
    return `Database table/column missing — run the SQL migration in Supabase SQL Editor: ${err?.message || ''}`;
  if (raw.includes('duplicate') || raw.includes('unique'))
    return 'Duplicate entry — this record already exists';
  if (raw.includes('permission') || raw.includes('rls'))
    return 'Supabase RLS is blocking this — disable RLS on the affected table in Supabase';
  if (raw.includes('failed to fetch') || raw.includes('networkerror'))
    return 'Network error — check your internet connection and Supabase status';

  /* ---- Fallback ---- */
  return err?.message || err?.error || String(err) || 'Unknown error';
}

/* ============================================================
   LOGIN
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const pwInput = document.getElementById('adminPassword');
  if (pwInput) pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
});

function adminLogin() {
  const pw = document.getElementById('adminPassword').value;
  const alertEl = document.getElementById('loginAlert');

  if (pw === CONFIG.ADMIN_PASSWORD) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminLayout').style.display = 'flex';
    loadOverview();
    loadSubmissions();
    loadWinners();
    loadQuizForEdit();
    loadAllQuizzes();
    loadSettings();
  } else {
    alertEl.innerHTML = '<div class="alert alert-error">Incorrect password.</div>';
    document.getElementById('adminPassword').value = '';
  }
}

function adminLogout() {
  document.getElementById('adminLayout').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminPassword').value = '';
}

/* ============================================================
   SIDEBAR NAVIGATION
============================================================ */
function showPage(name) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');
  const nav = document.getElementById(`nav-${name}`);
  if (nav) nav.classList.add('active');

  if (name === 'overview')    loadOverview();
  if (name === 'submissions') loadSubmissions();
  if (name === 'winners')     loadWinners();
  if (name === 'quiz')        loadAllQuizzes();
  if (name === 'settings')    loadSettings();
}

/* ============================================================
   OVERVIEW
============================================================ */
async function loadOverview() {
  try {
    const { data: allSubs, error: subErr } = await db.from('submissions').select('status');
    if (subErr) throw subErr;

    if (allSubs) {
      document.getElementById('statTotal').textContent    = allSubs.length;
      document.getElementById('statPending').textContent  = allSubs.filter(s => s.status === 'pending').length;
      document.getElementById('statApproved').textContent = allSubs.filter(s => s.status === 'approved').length;
      document.getElementById('statPaid').textContent     = allSubs.filter(s => s.status === 'paid').length;
    }

    const { data: quiz, error: qErr } = await db
      .from('quizzes').select('*').eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (qErr) throw qErr;

    const el = document.getElementById('overviewQuiz');
    if (!quiz) {
      el.innerHTML = '<p class="text-muted" style="font-size:0.875rem">No active quiz. Go to Quiz tab to create one.</p>';
      return;
    }

    const deadline = quiz.deadline
      ? new Date(quiz.deadline).toLocaleString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
      : 'No deadline';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px">
        <div><div class="stat-label">Title</div><div style="margin-top:4px;font-weight:600">${escapeHtml(quiz.title)}</div></div>
        <div><div class="stat-label">Display Reward</div><div style="margin-top:4px;color:var(--gold);font-weight:600">${escapeHtml(quiz.reward || '—')}</div></div>
        <div><div class="stat-label">SOL Amount</div><div style="margin-top:4px;color:var(--accent);font-weight:600">${quiz.reward_sol ? quiz.reward_sol + ' SOL' : '⚠️ not set'}</div></div>
        <div><div class="stat-label">Deadline</div><div style="margin-top:4px;font-size:0.875rem">${deadline}</div></div>
        <div><div class="stat-label">Status</div><div style="margin-top:4px"><span class="badge badge-active">🟢 Active</span></div></div>
      </div>
      <p style="margin-top:16px;color:var(--text-muted);font-size:0.9rem">${escapeHtml(quiz.question)}</p>
    `;

  } catch (err) {
    showToast(`Overview failed to load: ${decodeError(err)}`, 'error');
  }
}

/* ============================================================
   SUBMISSIONS
============================================================ */
async function loadSubmissions() {
  const loading  = document.getElementById('submissionsLoading');
  const tableDiv = document.getElementById('submissionsTable');
  const emptyDiv = document.getElementById('submissionsEmpty');
  const tbody    = document.getElementById('submissionsBody');
  if (!loading) return;

  loading.classList.remove('hidden');
  tableDiv.classList.add('hidden');
  emptyDiv.classList.add('hidden');

  try {
    const statusFilter = document.getElementById('filterStatus')?.value || '';
    const searchFilter = document.getElementById('filterSearch')?.value?.trim().toLowerCase() || '';

    let query = db
      .from('submissions')
      .select('*, quizzes(title, reward, reward_sol)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (statusFilter) query = query.eq('status', statusFilter);

    const { data, error } = await query;
    loading.classList.add('hidden');
    if (error) throw error;

    const filtered = searchFilter
      ? data.filter(r =>
          r.username?.toLowerCase().includes(searchFilter) ||
          r.wallet?.toLowerCase().includes(searchFilter))
      : data;

    if (!filtered || filtered.length === 0) { emptyDiv.classList.remove('hidden'); return; }

    tbody.innerHTML = filtered.map(row => {
      const date = row.created_at
        ? new Date(row.created_at).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
        : '—';
      const wallet = row.wallet ? `${row.wallet.slice(0,6)}…${row.wallet.slice(-4)}` : '—';
      const answerShort = row.answer
        ? (row.answer.length > 60 ? row.answer.slice(0, 60) + '…' : row.answer) : '';

      let actions = '';
      if (row.status === 'pending') {
        actions = `
          <div class="admin-action-btns">
            <button class="btn btn-primary btn-sm" onclick="updateStatus(${row.id},'approved')">✓ Approve</button>
            <button class="btn btn-danger btn-sm"  onclick="updateStatus(${row.id},'rejected')">✕ Reject</button>
          </div>`;
      } else if (row.status === 'approved') {
        const rewardDisplay = row.quizzes?.reward_sol ? `${row.quizzes.reward_sol} SOL` : (row.quizzes?.reward || '—');
        const walletSafe    = (row.wallet || '').replace(/'/g, "\\'");
        const usernameSafe  = (row.username || '').replace(/'/g, "\\'");
        const rewardSolVal  = parseFloat(row.quizzes?.reward_sol) || 0;
        actions = `
          <div class="admin-action-btns">
            <button class="btn btn-gold btn-sm" onclick="openPayModal(${row.id}, '${walletSafe}', '${usernameSafe}', '${rewardDisplay}', ${rewardSolVal})">💸 Pay via Jupiter</button>
            <button class="btn btn-danger btn-sm"  onclick="updateStatus(${row.id},'rejected')">✕ Reject</button>
          </div>`;
      } else if (row.status === 'processing') {
        const walletSafe    = (row.wallet || '').replace(/'/g, "\\'");
        const usernameSafe  = (row.username || '').replace(/'/g, "\\'");
        const rewardDisplay = row.quizzes?.reward_sol ? `${row.quizzes.reward_sol} SOL` : (row.quizzes?.reward || '—');
        const rewardSolVal  = parseFloat(row.quizzes?.reward_sol) || 0;
        actions = `
          <div class="admin-action-btns">
            <span style="color:var(--purple);font-size:0.82rem;display:block;margin-bottom:6px">⚠️ Stuck in processing</span>
            <button class="btn btn-gold btn-sm" onclick="openPayModal(${row.id}, '${walletSafe}', '${usernameSafe}', '${rewardDisplay}', ${rewardSolVal})">💸 Pay via Jupiter</button>
            <button class="btn btn-outline btn-sm" onclick="updateStatus(${row.id},'approved')">↺ Reset to Approved</button>
          </div>`;
      } else if (row.status === 'paid') {
        const txLink = row.tx_hash
          ? `<a href="https://solscan.io/tx/${row.tx_hash}" target="_blank" rel="noopener" class="tx-link" style="font-size:0.78rem">View TX ↗</a>`
          : '';
        actions = `<span style="color:var(--gold);font-size:0.8rem">✅ Paid ${txLink}</span>`;
      } else if (row.status === 'rejected') {
        actions = `
          <div class="admin-action-btns">
            <button class="btn btn-outline btn-sm" onclick="updateStatus(${row.id},'pending')">↺ Reset</button>
          </div>`;
      }

      return `
        <tr>
          <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${date}</td>
          <td style="font-weight:600">${escapeHtml(row.username)}</td>
          <td style="font-family:'Courier New',monospace;font-size:0.8rem;color:var(--text-muted)" title="${escapeHtml(row.wallet)}">${wallet}</td>
          <td>
            <div class="admin-answer-text" title="${escapeHtml(row.answer)}">${escapeHtml(answerShort)}</div>
            ${row.answer && row.answer.length > 60
              ? `<button class="expand-row" onclick="toggleAnswer(this)" data-full="${escapeHtml(row.answer)}">Show full ↓</button>`
              : ''}
          </td>
          <td><span class="badge badge-${row.status}">${statusLabel(row.status)}</span></td>
          <td>${actions}</td>
        </tr>`;
    }).join('');

    tableDiv.classList.remove('hidden');

  } catch (err) {
    loading.classList.add('hidden');
    const msg = decodeError(err);
    document.getElementById('submissionsAlert').innerHTML =
      `<div class="alert alert-error">Failed to load submissions: ${msg}</div>`;
    showToast(`Submissions load failed: ${msg}`, 'error');
  }
}

function toggleAnswer(btn) {
  const full = btn.getAttribute('data-full');
  const existing = btn.nextElementSibling;
  if (existing && existing.classList.contains('sub-answer-full')) {
    existing.remove(); btn.textContent = 'Show full ↓';
  } else {
    const div = document.createElement('div');
    div.className = 'sub-answer-full';
    div.textContent = full;
    btn.insertAdjacentElement('afterend', div);
    btn.textContent = 'Hide ↑';
  }
}

/* ============================================================
   UPDATE STATUS
============================================================ */
async function updateStatus(id, newStatus) {
  try {
    const { error } = await db.from('submissions').update({ status: newStatus }).eq('id', id);
    if (error) throw error;
    showToast(`Submission marked as ${newStatus}.`, 'success', 4000);
    loadSubmissions();
    loadOverview();
  } catch (err) {
    const msg = decodeError(err);
    showToast(`Failed to update status: ${msg}`, 'error', 0);
  }
}

/* ============================================================
   PAY MODAL — Jupiter Mobile payment flow
============================================================ */

let _currentPayData = null;

function openPayModal(id, wallet, username, rewardDisplay, rewardSol) {
  _currentPayData = { id, wallet, rewardSol: parseFloat(rewardSol) || 0 };

  document.getElementById('modalWallet').textContent   = wallet;
  document.getElementById('modalUsername').textContent = username;
  document.getElementById('modalAmount').textContent   = rewardDisplay || '—';
  document.getElementById('modalAlert').innerHTML      = '';
  document.getElementById('modalStatus').style.display = 'none';
  document.getElementById('modalStatus').textContent   = '';
  document.getElementById('modalTxHash').value         = '';
  document.getElementById('manualFallback').style.display = 'none';

  const btn = document.getElementById('phantomPayBtn');
  btn.disabled    = false;
  btn.textContent = '💸 Pay via Jupiter';

  document.getElementById('modalCloseBtn').disabled = false;
  document.getElementById('payModal').style.display = 'flex';
}

function closePayModal() {
  document.getElementById('payModal').style.display = 'none';
  _currentPayData = null;
}

function toggleManualFallback() {
  const el = document.getElementById('manualFallback');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function setModalStatus(msg) {
  const el = document.getElementById('modalStatus');
  el.textContent   = msg;
  el.style.display = msg ? 'block' : 'none';
}

async function _markPaid(id, txHash) {
  const { error } = await db
    .from('submissions')
    .update({ status: 'paid', tx_hash: txHash })
    .eq('id', id);
  if (error) throw error;
}

/* ---- Primary flow: Jupiter Mobile wallet ---- */
async function sendViaJupiter() {
  const alertDiv = document.getElementById('modalAlert');
  alertDiv.innerHTML = '';

  if (!_currentPayData) return;
  const { id, wallet, rewardSol } = _currentPayData;

  const provider = window.solana || window.jupiter?.solana || window.phantom?.solana;
  if (!provider) {
    const found = Object.keys(window).filter(k => ['solana','jupiter','phantom','wallet','coin98','slope','backpack'].includes(k));
    const hint = found.length ? ` (detected on window: ${found.join(', ')})` : ' (no wallet detected on window)';
    alertDiv.innerHTML = `<div class="alert alert-error">Wallet not found — open this page inside the Jupiter mobile app browser.${hint}</div>`;
    return;
  }
  if (!rewardSol || rewardSol <= 0) {
    alertDiv.innerHTML = '<div class="alert alert-error">No SOL amount set on this quiz. Edit the quiz and fill in the SOL Amount field.</div>';
    return;
  }

  const btn = document.getElementById('phantomPayBtn');
  btn.disabled = true;
  document.getElementById('modalCloseBtn').disabled = true;

  let step = 'init';
  let txSignature = null;

  try {
    /* 1. Connect */
    step = 'connect';
    setModalStatus('🔌 Connecting to Jupiter…');
    await provider.connect();

    /* 2. RPC connection */
    step = 'rpc';
    setModalStatus('⚙️ Connecting to network…');
    const rpc = CONFIG?.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
    const connection = new solanaWeb3.Connection(rpc, 'confirmed');

    /* 3. Balance check */
    step = 'balance';
    setModalStatus('💰 Checking wallet balance…');
    const lamports   = Math.round(rewardSol * solanaWeb3.LAMPORTS_PER_SOL);
    const FEE_BUFFER = 10000;
    const balance    = await connection.getBalance(provider.publicKey);
    if (balance < lamports + FEE_BUFFER) {
      const hasSol = (balance / solanaWeb3.LAMPORTS_PER_SOL).toFixed(4);
      throw new Error(`Not enough SOL. Wallet has ${hasSol} SOL, needs ${rewardSol} SOL + fee.`);
    }

    /* 4. Blockhash */
    step = 'blockhash';
    setModalStatus('🔗 Fetching blockhash…');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    /* 5. Build VersionedTransaction (modern format — works on Jupiter mobile) */
    step = 'build';
    const transferIx = solanaWeb3.SystemProgram.transfer({
      fromPubkey: provider.publicKey,
      toPubkey:   new solanaWeb3.PublicKey(wallet),
      lamports,
    });
    const message = new solanaWeb3.TransactionMessage({
      payerKey:        provider.publicKey,
      recentBlockhash: blockhash,
      instructions:    [transferIx],
    }).compileToV0Message();
    const transaction = new solanaWeb3.VersionedTransaction(message);

    /* 6. Jupiter approval + broadcast (signAndSendTransaction handles both) */
    step = 'jupiter';
    setModalStatus('👆 Approve the transaction in Jupiter…');
    const result = await provider.signAndSendTransaction(transaction);
    txSignature = result.signature;

    /* 7. Wait for confirmation */
    step = 'confirm';
    setModalStatus('⏳ Waiting for confirmation…');
    try {
      await connection.confirmTransaction(
        { signature: txSignature, blockhash, lastValidBlockHeight },
        'confirmed'
      );
    } catch (confirmErr) {
      console.warn('[QuizCup] confirmTransaction error (TX still broadcast):', confirmErr);
    }

    /* 8. Record in Supabase */
    step = 'record';
    setModalStatus('💾 Recording payment…');
    await _markPaid(id, txSignature);

    showToast(
      `✅ Payment sent! ${rewardSol} SOL → <a href="https://solscan.io/tx/${txSignature}" target="_blank" style="color:inherit;text-decoration:underline">View on Solscan ↗</a>`,
      'success', 0
    );
    closePayModal();
    loadSubmissions();
    loadOverview();
    loadWinners();

  } catch (err) {
    setModalStatus('');

    /* ---- Dump every property of the error so we can diagnose it ---- */
    let errDump = '(no error object)';
    try {
      const allProps = {};
      const keys = Object.getOwnPropertyNames(err || {});
      keys.forEach(k => { try { allProps[k] = err[k]; } catch(_){} });
      /* Also capture non-own properties common on wallet errors */
      ['message','name','code','stack','type','error','data','details','cause'].forEach(k => {
        if (err?.[k] !== undefined) allProps[k] = err[k];
      });
      errDump = JSON.stringify(allProps, null, 2);
    } catch (_) {
      errDump = String(err);
    }
    console.error(`[QuizCup] ❌ Payment failed at step "${step}".\nFull error dump:\n${errDump}`);

    const raw = err?.message || String(err) || 'Unknown error';
    const code = err?.code !== undefined ? ` (code ${err.code})` : '';
    const isRejected = raw.toLowerCase().includes('rejected') || raw.toLowerCase().includes('user rejected');

    let headline = `Failed at step: <strong>${step}</strong>${isRejected ? ' — cancelled' : ''}`;

    /* If TX broadcast already happened but recording failed, surface the signature */
    const sigNote = txSignature
      ? `<br><br>⚠️ <strong>TX was broadcast but not recorded.</strong><br>
         Paste this into the manual entry below:<br>
         <code style="font-size:0.72rem;word-break:break-all;display:block;margin-top:4px;padding:6px;background:rgba(0,0,0,0.3);border-radius:4px">${txSignature}</code>`
      : '';

    alertDiv.innerHTML = `
      <div class="alert alert-error" style="font-size:0.82rem">
        <div style="margin-bottom:6px">${headline}</div>
        <div style="opacity:0.9"><strong>Error:</strong> ${escapeHtml(raw)}${code}</div>
        <details style="margin-top:8px;cursor:pointer">
          <summary style="opacity:0.7;font-size:0.75rem">Full debug info (tap to expand)</summary>
          <pre style="font-size:0.68rem;white-space:pre-wrap;word-break:break-all;margin-top:6px;padding:8px;background:rgba(0,0,0,0.4);border-radius:4px;max-height:200px;overflow:auto">${escapeHtml(errDump)}</pre>
        </details>
        ${sigNote}
      </div>`;

    btn.disabled = false;
    document.getElementById('modalCloseBtn').disabled = false;
    btn.textContent = '💸 Pay via Jupiter';
  }
}

/* ---- Fallback: manual TX entry ---- */
async function confirmManualPay() {
  const txHash   = document.getElementById('modalTxHash').value.trim();
  const alertDiv = document.getElementById('modalAlert');
  alertDiv.innerHTML = '';

  if (!txHash) {
    alertDiv.innerHTML = '<div class="alert alert-error">Please paste the TX signature.</div>';
    return;
  }
  if (!_currentPayData) return;

  try {
    await _markPaid(_currentPayData.id, txHash);
    showToast(
      `Marked as paid. <a href="https://solscan.io/tx/${txHash}" target="_blank" style="color:inherit;text-decoration:underline">View on Solscan ↗</a>`,
      'success', 0
    );
    closePayModal();
    loadSubmissions();
    loadOverview();
    loadWinners();
  } catch (err) {
    alertDiv.innerHTML = `<div class="alert alert-error">Failed: ${decodeError(err)}</div>`;
  }
}

/* Close modal on backdrop click */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('payModal').addEventListener('click', function(e) {
    if (e.target === this) closePayModal();
  });
});

/* ============================================================
   WINNERS
============================================================ */
async function loadWinners() {
  const loading = document.getElementById('winnersLoading');
  const table   = document.getElementById('winnersTable');
  const empty   = document.getElementById('winnersEmpty');
  const tbody   = document.getElementById('winnersBody');
  if (!loading) return;

  loading.classList.remove('hidden');
  table.classList.add('hidden');
  empty.classList.add('hidden');

  try {
    const { data, error } = await db
      .from('submissions').select('*, quizzes(title, reward, reward_sol)')
      .eq('status', 'paid').order('created_at', { ascending: false });
    loading.classList.add('hidden');
    if (error) throw error;

    if (!data || data.length === 0) { empty.classList.remove('hidden'); return; }

    tbody.innerHTML = data.map(row => {
      const date   = row.created_at ? new Date(row.created_at).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }) : '—';
      const wallet = row.wallet ? `${row.wallet.slice(0,6)}…${row.wallet.slice(-4)}` : '—';
      const rewardDisplay = row.quizzes?.reward_sol ? `${row.quizzes.reward_sol} SOL` : (row.quizzes?.reward || '—');
      const txLink = row.tx_hash
        ? `<a href="https://solscan.io/tx/${row.tx_hash}" target="_blank" rel="noopener" class="tx-link">${row.tx_hash.slice(0,10)}…</a>`
        : '—';

      return `
        <tr>
          <td style="color:var(--text-muted);font-size:0.8rem">${date}</td>
          <td style="font-weight:600;color:var(--gold)">${escapeHtml(row.username)}</td>
          <td style="font-family:'Courier New',monospace;font-size:0.8rem;color:var(--text-muted)" title="${escapeHtml(row.wallet)}">${wallet}</td>
          <td style="color:var(--accent);font-weight:600">${escapeHtml(rewardDisplay)}</td>
          <td>${txLink}</td>
        </tr>`;
    }).join('');

    table.classList.remove('hidden');

  } catch (err) {
    loading.classList.add('hidden');
    showToast(`Winners failed to load: ${decodeError(err)}`, 'error');
  }
}

/* ============================================================
   QUIZ MANAGEMENT
============================================================ */
async function loadQuizForEdit() {
  try {
    const { data, error } = await db
      .from('quizzes').select('*').eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) fillQuizForm(data);
  } catch (err) {
    showToast(`Could not load active quiz: ${decodeError(err)}`, 'warn');
  }
}

async function loadAllQuizzes() {
  const loading = document.getElementById('allQuizzesLoading');
  const table   = document.getElementById('allQuizzesTable');
  const tbody   = document.getElementById('allQuizzesBody');
  if (!loading) return;

  loading.classList.remove('hidden');
  table.classList.add('hidden');

  try {
    const { data, error } = await db.from('quizzes').select('*').order('created_at', { ascending: false });
    loading.classList.add('hidden');
    if (error) throw error;

    if (!data || data.length === 0) {
      table.innerHTML = '<p class="text-muted" style="padding:20px 0;font-size:0.875rem">No quizzes yet.</p>';
      table.classList.remove('hidden');
      return;
    }

    tbody.innerHTML = data.map(quiz => {
      const deadline = quiz.deadline
        ? new Date(quiz.deadline).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }) : '—';
      return `
        <tr>
          <td style="font-weight:600">${escapeHtml(quiz.title)}</td>
          <td style="color:var(--gold)">${escapeHtml(quiz.reward || '—')}</td>
          <td style="color:var(--accent);font-size:0.85rem">${quiz.reward_sol ? quiz.reward_sol + ' SOL' : '<span style="color:var(--text-muted)">—</span>'}</td>
          <td style="color:var(--text-muted);font-size:0.85rem">${deadline}</td>
          <td><span class="badge badge-${quiz.status}">${quiz.status}</span></td>
          <td>
            <div class="admin-action-btns">
              <button class="btn btn-outline btn-sm" onclick="editQuiz(${quiz.id})">✏️ Edit</button>
              ${quiz.status === 'active'
                ? `<button class="btn btn-outline btn-sm" onclick="setQuizStatus(${quiz.id},'closed')">Close</button>`
                : `<button class="btn btn-primary btn-sm" onclick="setQuizStatus(${quiz.id},'active')">Activate</button>`}
            </div>
          </td>
        </tr>`;
    }).join('');

    table.classList.remove('hidden');

  } catch (err) {
    loading.classList.add('hidden');
    showToast(`Quizzes failed to load: ${decodeError(err)}`, 'error');
  }
}

function fillQuizForm(quiz) {
  document.getElementById('quizId').value         = quiz.id || '';
  document.getElementById('quizTitle').value       = quiz.title || '';
  document.getElementById('quizQuestion').value    = quiz.question || '';
  document.getElementById('quizDescription').value = quiz.description || '';
  document.getElementById('quizReward').value      = quiz.reward || '';
  document.getElementById('quizRewardSol').value   = quiz.reward_sol || '';
  document.getElementById('quizStatus').value      = quiz.status || 'active';
  if (quiz.deadline) {
    const d = new Date(quiz.deadline);
    document.getElementById('quizDeadline').value =
      new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  } else {
    document.getElementById('quizDeadline').value = '';
  }
  const bar = document.getElementById('quizModeBar');
  bar.style.display = 'flex';
  document.getElementById('quizModeLabel').textContent = `✏️ Editing: "${quiz.title || 'Quiz #' + quiz.id}"`;
}

async function editQuiz(id) {
  try {
    const { data, error } = await db.from('quizzes').select('*').eq('id', id).single();
    if (error) throw error;
    fillQuizForm(data);
    document.getElementById('quizTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    showToast(`Failed to load quiz: ${decodeError(err)}`, 'error');
  }
}

async function setQuizStatus(id, newStatus) {
  try {
    const { error } = await db.from('quizzes').update({ status: newStatus }).eq('id', id);
    if (error) throw error;
    showToast(`Quiz ${newStatus === 'active' ? 'activated' : 'closed'}.`, 'success', 4000);
    loadAllQuizzes();
    loadOverview();
  } catch (err) {
    showToast(`Failed to update quiz: ${decodeError(err)}`, 'error');
  }
}

async function saveQuiz() {
  const id          = document.getElementById('quizId').value;
  const title       = document.getElementById('quizTitle').value.trim();
  const question    = document.getElementById('quizQuestion').value.trim();
  const description = document.getElementById('quizDescription').value.trim();
  const reward      = document.getElementById('quizReward').value.trim();
  const rewardSolRaw = document.getElementById('quizRewardSol').value.trim();
  const deadline    = document.getElementById('quizDeadline').value || null;
  const status      = document.getElementById('quizStatus').value;
  const alertDiv    = document.getElementById('quizAlert');

  alertDiv.innerHTML = '';

  if (!title)    { alertDiv.innerHTML = '<div class="alert alert-error">Title is required.</div>';    return; }
  if (!question) { alertDiv.innerHTML = '<div class="alert alert-error">Question is required.</div>'; return; }

  const reward_sol = rewardSolRaw ? parseFloat(rewardSolRaw) : null;
  if (rewardSolRaw && (isNaN(reward_sol) || reward_sol <= 0)) {
    alertDiv.innerHTML = '<div class="alert alert-error">SOL amount must be a positive number (e.g. 0.5).</div>';
    return;
  }

  if (!rewardSolRaw) {
    showToast('Tip: you haven\'t set a SOL amount — payments won\'t be auto-sent until you do.', 'warn', 7000);
  }

  try {
    const payload = { title, question, description, reward, reward_sol, deadline, status };
    const { error } = id
      ? await db.from('quizzes').update(payload).eq('id', id)
      : await db.from('quizzes').insert(payload);

    if (error) throw error;

    alertDiv.innerHTML = '<div class="alert alert-success">✅ Quiz saved successfully.</div>';
    setTimeout(() => { alertDiv.innerHTML = ''; }, 4000);
    showToast('Quiz saved.', 'success', 3000);
    loadAllQuizzes();
    loadOverview();

  } catch (err) {
    const msg = decodeError(err);
    alertDiv.innerHTML = `<div class="alert alert-error">Save failed: ${msg}</div>`;
    showToast(`Quiz save failed: ${msg}`, 'error', 0);
  }
}

function clearQuizForm() {
  ['quizId','quizTitle','quizQuestion','quizDescription','quizReward','quizRewardSol','quizDeadline']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('quizStatus').value = 'active';
  document.getElementById('quizModeBar').style.display = 'none';
}

/* ============================================================
   SETTINGS
============================================================ */
async function loadSettings() {
  try {
    const { data, error } = await db.from('settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    if (!data) return;

    document.getElementById('settingCA').value         = data.contract_address || '';
    document.getElementById('settingShowCA').checked   = data.show_ca !== false;
    document.getElementById('settingXHandle').value    = data.x_handle || '';
    document.getElementById('settingXUrl').value       = data.x_url || '';
    document.getElementById('settingLogo').value       = data.logo || '';
    document.getElementById('settingBackground').value = data.background || '';

  } catch (err) {
    showToast(`Settings failed to load: ${decodeError(err)}`, 'warn');
  }
}

async function saveSettings() {
  const alertDiv = document.getElementById('settingsAlert');
  alertDiv.innerHTML = '';

  const payload = {
    contract_address: document.getElementById('settingCA').value.trim(),
    show_ca:          document.getElementById('settingShowCA').checked,
    x_handle:         document.getElementById('settingXHandle').value.trim(),
    x_url:            document.getElementById('settingXUrl').value.trim(),
    logo:             document.getElementById('settingLogo').value.trim(),
    background:       document.getElementById('settingBackground').value.trim()
  };

  try {
    const { error } = await db.from('settings').upsert({ id: 1, ...payload });
    if (error) throw error;
    alertDiv.innerHTML = '<div class="alert alert-success">✅ Settings saved.</div>';
    setTimeout(() => { alertDiv.innerHTML = ''; }, 3000);
    showToast('Settings saved.', 'success', 3000);
  } catch (err) {
    const msg = decodeError(err);
    alertDiv.innerHTML = `<div class="alert alert-error">Save failed: ${msg}</div>`;
    showToast(`Settings save failed: ${msg}`, 'error', 0);
  }
}

/* ============================================================
   UTILITIES
============================================================ */
function statusLabel(s) {
  return { pending:'⏳ Pending', approved:'✅ Approved', processing:'⚡ Sending', paid:'🏆 Paid', rejected:'❌ Rejected' }[s] || s;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
