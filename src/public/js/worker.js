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

/* ---------------- Theme ---------------- */

function getStoredTheme() {
    try {
        const stored = localStorage.getItem('worldnet_theme');
        return stored === 'dark' || stored === 'light' || stored === 'auto' ? stored : 'auto';
    } catch (_error) {
        return 'auto';
    }
}

function systemPrefersDark() {
    try {
        return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (_error) {
        return false;
    }
}

function resolveTheme(preference) {
    if (preference === 'dark' || preference === 'light') return preference;
    return systemPrefersDark() ? 'dark' : 'light';
}

function setThemeIcons(preference) {
    const glyph = preference === 'auto' ? '◐' : (preference === 'dark' ? '☾' : '☀');
    const title = preference === 'auto'
        ? `Theme: System (${resolveTheme('auto')}) — tap to force light`
        : (preference === 'dark' ? 'Theme: Dark — tap to use system theme' : 'Theme: Light — tap to force dark');
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
        btn.title = title;
        btn.setAttribute('aria-label', title);
        const icon = btn.querySelector('.theme-icon');
        if (icon) icon.textContent = glyph;
    });
}

function applyTheme() {
    const preference = getStoredTheme();
    document.documentElement.setAttribute('data-theme', resolveTheme(preference));
    setThemeIcons(preference);
}

function watchSystemTheme() {
    try {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onSystemChange = () => {
            if (getStoredTheme() === 'auto') applyTheme();
        };
        if (media.addEventListener) media.addEventListener('change', onSystemChange);
        else if (media.addListener) media.addListener(onSystemChange);
    } catch (_error) {
        /* no system theme support */
    }
}

function toggleTheme() {
    const order = ['auto', 'light', 'dark'];
    const current = getStoredTheme();
    const next = order[(order.indexOf(current) + 1) % order.length];
    try {
        localStorage.setItem('worldnet_theme', next);
    } catch (_error) {
        /* storage unavailable */
    }
    applyTheme();
}

function wireThemeToggle() {
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
        btn.onclick = (event) => {
            event.stopPropagation();
            toggleTheme();
        };
    });
}

/* ---------------- Avatar + profile ---------------- */

function renderAvatar(profile, size) {
    const name = String(profile?.name || 'W');
    const photo = profile?.profilePhoto;
    const sizeStyle = `width:${size}px;height:${size}px`;
    if (photo && photo.startsWith('data:image/')) {
        return `<span class="avatar avatar-photo" style="${sizeStyle}"><img src="${photo}" alt="${escapeHtml(name)}" onerror="this.remove()" /></span>`;
    }
    return `<span class="avatar" style="${sizeStyle};font-size:${Math.max(12, Math.round(size * 0.42))}px">${escapeHtml(getInitials(name))}</span>`;
}

function processImageFile(file, maxSize = 480, quality = 0.72) {
    return new Promise((resolve) => {
        if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
            resolve('');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const image = new Image();
            image.onload = () => {
                const longest = Math.max(image.width, image.height);
                const scale = longest > maxSize ? maxSize / longest : 1;
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(image.width * scale);
                canvas.height = Math.round(image.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                let type = file.type;
                if (type === 'image/webp' || type === 'image/gif') type = 'image/jpeg';
                resolve(canvas.toDataURL(type, quality));
            };
            image.onerror = () => resolve('');
            image.src = reader.result;
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
}

function openProfileModal() {
    const profile = getWorkerProfile() || {};
    const existing = document.getElementById('profile-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'credential-overlay';
    overlay.id = 'profile-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
        <div class="credential-modal profile-modal">
            <button type="button" class="credential-close" id="profile-close" aria-label="Close">&times;</button>
            <h3>My profile</h3>
            <p class="profile-sub">Update your display name and profile photo.</p>
            <div class="profile-preview" id="profile-preview">${renderAvatar(profile, 88)}</div>
            <form class="profile-form" id="profile-form">
                <label for="profile-photo-input">Profile photo</label>
                <input type="file" id="profile-photo-input" accept="image/png,image/jpeg,image/webp,image/gif" />
                <label for="profile-name">Full name</label>
                <input type="text" id="profile-name" value="${escapeHtml(profile.name || '')}" placeholder="Your full name" required />
                <label for="profile-email">Email</label>
                <input type="email" id="profile-email" value="${escapeHtml(profile.email || '')}" disabled />
                <button type="submit" class="btn-wn btn-wn-primary" id="profile-save">Save changes</button>
            </form>
        </div>`;
    document.body.appendChild(overlay);

    let pendingPhoto = '';
    overlay.querySelector('#profile-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) overlay.remove();
    });
    const photoInput = overlay.querySelector('#profile-photo-input');
    const preview = overlay.querySelector('#profile-preview');
    photoInput.addEventListener('change', async () => {
        const dataUrl = await processImageFile(photoInput.files && photoInput.files[0]);
        if (!dataUrl) return;
        pendingPhoto = dataUrl;
        preview.innerHTML = `<span class="avatar avatar-photo" style="width:88px;height:88px"><img src="${dataUrl}" alt="Preview" /></span>`;
    });
    overlay.querySelector('#profile-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = overlay.querySelector('#profile-name').value.trim();
        if (!name) {
            showToast('Please enter your name.');
            return;
        }
        const button = overlay.querySelector('#profile-save');
        if (button) {
            button.disabled = true;
            button.textContent = 'Saving…';
        }
        try {
            const updated = await workerApi('/api/profile', {
                method: 'PUT',
                body: JSON.stringify({ name, profilePhoto: pendingPhoto })
            });
            const saved = getWorkerProfile() || {};
            localStorage.setItem(WORKER_PROFILE_KEY, JSON.stringify({ ...saved, ...updated }));
            showToast('Profile updated');
            setTimeout(() => window.location.reload(), 500);
        } catch (error) {
            if (button) {
                button.disabled = false;
                button.textContent = 'Save changes';
            }
            showToast(error.message);
        }
    });
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
            <div class="worker-user" id="worker-user" title="Edit your profile">
                ${renderAvatar(worker, 40)}
                <div class="user-info">
                    <strong>${escapeHtml(worker.name)}</strong>
                    <span>${escapeHtml(worker.department)} · ${escapeHtml(worker.role)}</span>
                </div>
                <button class="icon-button theme-toggle" id="worker-theme-toggle" title="Switch to dark mode" style="background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.14); color:#fff"><span class="theme-icon">☾</span></button>
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
        window.location.href = '/admin/login.html';
    });

    document.getElementById('worker-user').addEventListener('click', openProfileModal);
    applyTheme();
    wireThemeToggle();
}

function initWorker() {
    if (!getWorkerToken()) {
        window.location.href = '/admin/login.html';
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
                window.location.href = '/admin/login.html';
            } else {
                showToast(error.message);
            }
        });
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    watchSystemTheme();
    wireThemeToggle();
    renderToggleIcons();
    wireWorkerLogin();
    const isWorkerPage = window.location.pathname === '/worker.html';
    if (isWorkerPage && getWorkerToken()) {
        initWorker();
    }
});
