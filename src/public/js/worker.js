/* ============================================================
   WorldNet Team Portal
   Workers sign in with their own credentials and see the
   consultations assigned to them.
   ============================================================ */

const WORKER_TOKEN_KEY = 'worldnet_worker_token';
const WORKER_PROFILE_KEY = 'worldnet_worker_profile';

function getWorkerToken() {
    return localStorage.getItem(WORKER_TOKEN_KEY);
}

function getWorkerProfile() {
    try {
        return JSON.parse(localStorage.getItem(WORKER_PROFILE_KEY) || 'null');
    } catch {
        return null;
    }
}

function storeWorkerAuth(data) {
    localStorage.setItem(WORKER_TOKEN_KEY, data.token);
    localStorage.setItem(WORKER_PROFILE_KEY, JSON.stringify(data.worker));
}

function clearWorkerAuth() {
    localStorage.removeItem(WORKER_TOKEN_KEY);
    localStorage.removeItem(WORKER_PROFILE_KEY);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function getInitials(name) {
    return String(name || 'W')
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function statusClass(status) {
    return String(status || '').toLowerCase();
}

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

async function workerApi(path, options = {}) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${getWorkerToken()}` },
        ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function renderToggleIcons() {
    document.querySelectorAll('.password-toggle').forEach((button) => {
        const targetId = button.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        button.setAttribute('aria-label', 'Show password');
        button.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        });
    });
}

/* ---------------- Worker login ---------------- */

function wireWorkerLogin() {
    const form = document.getElementById('worker-login-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const data = await workerApi('/api/worker/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            storeWorkerAuth(data);
            window.location.href = '/worker.html';
        } catch (error) {
            showToast(error.message);
            button.disabled = false;
        }
    });
}

/* ---------------- Worker dashboard ---------------- */

function buildWorkerHeader(worker) {
    return `
        <header class="worker-topbar">
            <div class="worker-brand">
                <div class="brand-mark">W</div>
                <div class="brand-text">
                    <strong>WorldNet</strong>
                    <span>Team Portal</span>
                </div>
            </div>
            <div class="worker-user">
                <div class="avatar">${escapeHtml(getInitials(worker.name))}</div>
                <div class="user-info">
                    <strong>${escapeHtml(worker.name)}</strong>
                    <span>${escapeHtml(worker.department)} · ${escapeHtml(worker.role)}</span>
                </div>
                <button class="icon-button" id="worker-logout-btn" title="Log out" style="background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.14); color:#fff">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>
                </button>
            </div>
        </header>`;
}

function renderWorkerDashboard(worker, assignments) {
    const app = document.getElementById('worker-app');
    const openCount = assignments.filter((item) => item.status === 'pending' || item.status === 'confirmed').length;
    app.innerHTML = `
        ${buildWorkerHeader(worker)}
        <main class="worker-content">
            <div class="worker-welcome">
                <h1>Hello, ${escapeHtml(worker.name.split(' ')[0])}</h1>
                <p>Here are the assignments currently on your desk.</p>
            </div>
            <div class="worker-stats">
                <div class="stat-card"><strong>${assignments.length}</strong><span>Total assignments</span></div>
                <div class="stat-card"><strong>${openCount}</strong><span>Open</span></div>
                <div class="stat-card"><strong>${assignments.filter((item) => item.status === 'completed').length}</strong><span>Completed</span></div>
            </div>
            <div class="admin-card">
                <div class="card-head"><h3>My assignments</h3><span class="cell-muted">${escapeHtml(worker.department)} · ${escapeHtml(worker.role)}</span></div>
                ${assignments.length ? `
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead><tr><th>Requester</th><th>Company</th><th>Preferred</th><th>Notes</th><th>Status</th></tr></thead>
                        <tbody>
                            ${assignments.map((item) => `
                                <tr>
                                    <td class="cell-strong">${escapeHtml(item.name)}<br/><span class="cell-muted">${escapeHtml(item.email)} · ${escapeHtml(item.phone)}</span></td>
                                    <td class="cell-muted">${escapeHtml(item.company || '—')}</td>
                                    <td class="cell-muted">${escapeHtml(item.preferred_date)} @ ${escapeHtml(item.preferred_time)}</td>
                                    <td class="cell-muted" style="max-width:220px">${escapeHtml(item.notes || '—')}</td>
                                    <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : '<p class="cell-muted" style="padding:1rem">No assignments yet. Check back soon.</p>'}
            </div>
        </main>`;

    document.getElementById('worker-logout-btn').addEventListener('click', () => {
        clearWorkerAuth();
        window.location.href = '/worker-login.html';
    });
}

function initWorker() {
    if (!getWorkerToken()) {
        window.location.href = '/worker-login.html';
        return;
    }
    workerApi('/api/worker/me')
        .then((data) => {
            localStorage.setItem(WORKER_PROFILE_KEY, JSON.stringify(data.worker));
            renderWorkerDashboard(data.worker, data.assignments || []);
        })
        .catch((error) => {
            if (error.message.includes('token') || error.message.includes('Unauthorized')) {
                clearWorkerAuth();
                window.location.href = '/worker-login.html';
            } else {
                showToast(error.message);
            }
        });
}

document.addEventListener('DOMContentLoaded', () => {
    renderToggleIcons();
    wireWorkerLogin();
    const isWorkerPage = window.location.pathname === '/worker.html';
    if (isWorkerPage && getWorkerToken()) {
        initWorker();
    }
});
