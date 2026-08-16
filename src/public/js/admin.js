/* ============================================================
   WorldNet Admin Console
   Shared shell (sidebar + topbar) rendered on every admin page.
   Dashboard, records, and consultations views are rendered here.
   ============================================================ */

function getToken() {
    return localStorage.getItem('worldnet_token');
}

function getAdminProfile() {
    try {
        return JSON.parse(localStorage.getItem('worldnet_admin') || 'null');
    } catch {
        return null;
    }
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

function formatRelativeTime(dateString) {
    if (!dateString) return '—';
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString();
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function getInitials(name) {
    return String(name || 'A')
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
    const name = String(profile?.name || 'A');
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
    const profile = getAdminProfile() || {};
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
            const updated = await authApi('/api/profile', {
                method: 'PUT',
                body: JSON.stringify({ name, profilePhoto: pendingPhoto })
            });
            const saved = getAdminProfile() || {};
            localStorage.setItem('worldnet_admin', JSON.stringify({ ...saved, ...updated }));
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

/* ---------------- API ---------------- */

async function authApi(path, options = {}) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${getToken()}` },
        ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

async function publicApi(path, options = {}) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

/* ---------------- Icons ---------------- */

const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    services: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6"/></svg>',
    inquiries: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    consultations: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>',
    portfolio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    departments: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M9 11h.01M15 11h.01M9 15h.01M15 15h.01"/></svg>'
};

/* ---------------- Shared shell ---------------- */

const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', href: '/admin/dashboard.html', icon: 'dashboard' },
    { key: 'services', label: 'Services', href: '/admin/records.html?type=services', icon: 'services' },
    { key: 'inquiries', label: 'Inquiries', href: '/admin/records.html?type=inquiries', icon: 'inquiries' },
    { key: 'consultations', label: 'Consultations', href: '/admin/consultations.html', icon: 'consultations' },
    { key: 'portfolio', label: 'Portfolio', href: '/admin/records.html?type=portfolio', icon: 'portfolio' },
    { key: 'workers', label: 'Workers', href: '/admin/workers.html', icon: 'team' },
    { key: 'departments', label: 'Departments', href: '/admin/departments.html', icon: 'departments' },
    { key: 'team', label: 'Team', href: '/admin/dashboard.html#team', icon: 'team' }
];

function getCurrentPageKey() {
    const pathname = window.location.pathname;
    if (pathname === '/admin/dashboard.html') return 'dashboard';
    if (pathname === '/admin/consultations.html') return 'consultations';
    if (pathname === '/admin/workers.html') return 'workers';
    if (pathname === '/admin/departments.html') return 'departments';
    if (pathname === '/admin/records.html') {
        return new URLSearchParams(window.location.search).get('type') || 'services';
    }
    return null;
}

function buildSidebar(activeKey) {
    const admin = getAdminProfile();
    const groups = {
        general: NAV_ITEMS.slice(0, 7)
    };
    const navLinks = groups.general
        .map((item) => `
            <a class="nav-link ${item.key === activeKey ? 'active' : ''}" href="${item.href}">
                ${ICONS[item.icon]}
                <span>${item.label}</span>
            </a>`)
        .join('');

    return `
        <aside class="admin-sidebar" id="admin-sidebar">
            <div class="sidebar-brand">
                <div class="brand-mark">W</div>
                <div class="brand-text">
                    <strong>WorldNet</strong>
                    <span>Admin Console</span>
                </div>
            </div>
            <nav class="sidebar-nav">
                <p class="nav-group-label">Overview</p>
                ${navLinks}
            </nav>
            <div class="sidebar-user" id="sidebar-user" title="Edit your profile">
                ${renderAvatar(admin, 40)}
                <div class="user-info">
                    <strong>${escapeHtml(admin?.name || 'Admin')}</strong>
                    <span>${escapeHtml(admin?.email || '')}</span>
                </div>
                <button class="icon-button" id="logout-btn" title="Log out" style="margin-left:auto; background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.14); color:#fff">${ICONS.logout}</button>
            </div>
        </aside>`;
}

function buildTopbar(pageTitle, pageSubtitle) {
    return `
        <header class="admin-topbar">
            <button class="icon-button sidebar-toggle" id="sidebar-toggle" title="Menu">${ICONS.menu}</button>
            <div class="topbar-title">
                <h1>${pageTitle}</h1>
                <p>${pageSubtitle}</p>
            </div>
            <div class="topbar-actions">
                <button class="icon-button theme-toggle" id="theme-toggle" title="Switch to dark mode"><span class="theme-icon">☾</span></button>
                <button class="icon-button" id="profile-btn" title="Edit your profile">${renderAvatar(getAdminProfile(), 26)}</button>
                <div style="position:relative">
                    <button class="icon-button" id="bell-btn" title="Notifications">${ICONS.bell}<span class="bell-dot" id="bell-dot"></span></button>
                    <div class="notif-popover" id="notif-popover">
                        <div class="notif-popover-head">
                            <strong>Notifications</strong>
                            <button class="btn-wn btn-wn-ghost" id="mark-all-read" type="button" style="padding:0.3rem 0.6rem; font-size:0.74rem">Mark all read</button>
                        </div>
                        <div class="notif-list" id="notif-list"></div>
                    </div>
                </div>
            </div>
        </header>`;
}

function renderShell(activeKey, pageTitle, pageSubtitle) {
    const app = document.getElementById('admin-app');
    app.innerHTML = `
        ${buildSidebar(activeKey)}
        <div class="admin-backdrop" id="admin-backdrop"></div>
        <div class="admin-main">
            ${buildTopbar(pageTitle, pageSubtitle)}
            <main class="admin-content" id="admin-content"></main>
        </div>`;

    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('admin-backdrop');
    const toggleSidebar = () => {
        sidebar.classList.toggle('open');
        backdrop.classList.toggle('open');
    };
    const closeSidebar = () => {
        sidebar.classList.remove('open');
        backdrop.classList.remove('open');
    };

    document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
    backdrop.addEventListener('click', closeSidebar);
    sidebar.addEventListener('click', (event) => {
        if (event.target.closest('.nav-link')) closeSidebar();
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        localStorage.removeItem('worldnet_token');
        localStorage.removeItem('worldnet_admin');
        await fetch('/api/logout', { method: 'POST' }).catch(() => { });
        window.location.href = '/admin/login.html';
    });

    document.getElementById('bell-btn').addEventListener('click', (event) => {
        event.stopPropagation();
        document.getElementById('notif-popover').classList.toggle('open');
        loadNotifications();
    });

    const sidebarUser = document.getElementById('sidebar-user');
    if (sidebarUser) sidebarUser.addEventListener('click', openProfileModal);
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) profileBtn.addEventListener('click', openProfileModal);

    applyTheme();
    wireThemeToggle();

    document.addEventListener('click', () => {
        const popover = document.getElementById('notif-popover');
        if (popover) popover.classList.remove('open');
    });

    document.getElementById('mark-all-read').addEventListener('click', markAllNotificationsRead);
}

/* ---------------- Notifications ---------------- */

async function loadNotifications() {
    try {
        const notifications = await authApi('/api/admin/notifications');
        const unread = notifications.filter((n) => !n.read).length;
        const dot = document.getElementById('bell-dot');
        if (dot) dot.classList.toggle('show', unread > 0);
        const list = document.getElementById('notif-list');
        if (!list) return;
        list.innerHTML = notifications.length
            ? notifications.slice(0, 12).map((n) => `
                <div class="notif-item ${n.read ? '' : 'unread'}">
                    <strong>${escapeHtml(n.title)}</strong>
                    <p>${escapeHtml(n.message)}</p>
                    <span class="notif-time">${escapeHtml(formatRelativeTime(n.createdAt))} · ${escapeHtml(n.type)}</span>
                </div>`).join('')
            : '<div class="notif-item"><p style="margin:0">No notifications yet.</p></div>';
        return notifications;
    } catch {
        return [];
    }
}

async function markAllNotificationsRead() {
    try {
        const notifications = await authApi('/api/admin/notifications');
        for (const n of notifications.filter((item) => !item.read)) {
            await authApi(`/api/admin/notifications/${n.id}/read`, { method: 'PUT' });
        }
        showToast('All notifications marked as read');
        loadNotifications();
        if (document.getElementById('stats-notifications')) loadDashboard();
    } catch (error) {
        showToast(error.message);
    }
}

/* ---------------- Dashboard ---------------- */

function buildDashboard(admin) {
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `
        <section class="welcome-hero">
            <div class="welcome-inner">
                <div>
                    <p class="greeting">${timeGreeting()}</p>
                    <h2>Welcome back, <span class="accent">${escapeHtml(admin?.name?.split(' ')[0] || 'Admin')}</span> 👋</h2>
                    <p>Here is what is happening across WorldNet today. You have full control over services, client inquiries, and consultations.</p>
                </div>
                <div class="welcome-meta">
                    <span>📅 ${escapeHtml(today)}</span>
                    <span>·</span>
                    <span>Role: <strong>${escapeHtml(admin?.role || 'admin')}</strong></span>
                </div>
            </div>
        </section>

        <section class="stat-grid">
            ${statCard('services', 'Services', 'stats-services', '#2563eb', 'services')}
            ${statCard('inquiries', 'Inquiries', 'stats-inquiries', '#7c3aed', 'inquiries')}
            ${statCard('consultations', 'Consultations', 'stats-consultations', '#0f766e', 'consultations')}
            ${statCard('portfolio', 'Portfolio', 'stats-portfolio', '#b45309', 'portfolio')}
            ${statCard('workers', 'Team members', 'stats-workers', '#0ea5e9', 'team')}
            ${statCard('notifications', 'New alerts', 'stats-notifications', '#f43f5e', 'bell')}
        </section>

        <section class="panel-grid">
            <div class="panel">
                <div class="panel-header">
                    <h3>Quick actions</h3>
                    <span class="cell-muted">Shortcuts</span>
                </div>
                <div class="quick-actions">
                    <a class="quick-action" href="/admin/records.html?type=services">
                        <span class="qa-icon">${ICONS.services}</span> Manage services
                        <span class="qa-arrow">${ICONS.arrowRight}</span>
                    </a>
                    <a class="quick-action" href="/admin/records.html?type=inquiries">
                        <span class="qa-icon">${ICONS.inquiries}</span> Review inquiries
                        <span class="qa-arrow">${ICONS.arrowRight}</span>
                    </a>
                    <a class="quick-action" href="/admin/consultations.html">
                        <span class="qa-icon">${ICONS.consultations}</span> Assign consultations
                        <span class="qa-arrow">${ICONS.arrowRight}</span>
                    </a>
                    <a class="quick-action" href="/admin/records.html?type=portfolio">
                        <span class="qa-icon">${ICONS.portfolio}</span> Portfolio items
                        <span class="qa-arrow">${ICONS.arrowRight}</span>
                    </a>
                </div>
            </div>
            <div class="panel">
                <div class="panel-header">
                    <h3>Inquiries by service</h3>
                    <span class="cell-muted">Distribution</span>
                </div>
                <div class="bar-chart" id="inquiry-chart"></div>
            </div>
            <div class="panel">
                <div class="panel-header">
                    <h3>Recent activity</h3>
                    <span class="cell-muted">Live feed</span>
                </div>
                <div class="activity-feed" id="activity-feed"></div>
            </div>
        </section>

        <div class="panel-grid panel-grid-split">
            <div class="panel">
                <div class="panel-header">
                    <h3>Team roster</h3>
                    <span class="cell-muted" id="stats-workers-label">0 members</span>
                </div>
                <div class="roster-grid" id="team-roster"></div>
                <details style="margin-top:1rem; border:1px solid var(--wn-border); border-radius:0.9rem; padding:0.6rem 0.8rem">
                    <summary style="font-weight:700; font-size:0.85rem; cursor:pointer">＋ Add team member</summary>
                    <form id="worker-form" class="admin-form" style="margin-top:0.8rem">
                        <div class="form-row">
                            <div><label>Name</label><input name="name" placeholder="Full name" required /></div>
                            <div><label>Department</label><input name="department" placeholder="e.g. Infrastructure" required /></div>
                        </div>
                        <div><label>Role</label><input name="role" placeholder="e.g. Network Engineer" required /></div>
                        <button class="btn-wn btn-wn-primary" type="submit">Add team member</button>
                    </form>
                </details>
            </div>
            <div class="panel">
                <div class="panel-header">
                    <h3>Content studio</h3>
                    <span class="cell-muted">Create & edit</span>
                </div>
                <details style="border:1px solid var(--wn-border); border-radius:0.9rem; padding:0.6rem 0.8rem">
                    <summary style="font-weight:700; font-size:0.85rem; cursor:pointer">${ICONS.services} New / edit service</summary>
                    <form id="service-form" class="admin-form" style="margin-top:0.8rem">
                        <input type="hidden" id="service-edit-id" name="id" />
                        <div class="form-row">
                            <div><label>Name</label><input name="name" placeholder="Service name" required /></div>
                            <div><label>Category</label><input name="category" placeholder="e.g. Infrastructure" required /></div>
                        </div>
                        <div><label>Summary</label><input name="summary" placeholder="Short one-liner" required /></div>
                        <div><label>Description</label><textarea name="description" placeholder="Full description"></textarea></div>
                        <div class="form-row">
                            <div><label>Icon</label><input name="icon" placeholder="e.g. shield-check" /></div>
                            <div><label>Price range</label><input name="priceRange" placeholder="e.g. Custom quote" /></div>
                        </div>
                        <div style="display:flex; gap:0.6rem; flex-wrap:wrap">
                            <button id="service-submit-btn" class="btn-wn btn-wn-primary" type="submit">Save service</button>
                            <button id="cancel-service-edit" class="btn-wn btn-wn-ghost" type="button" style="display:none">Cancel edit</button>
                        </div>
                    </form>
                </details>
                <details style="margin-top:0.7rem; border:1px solid var(--wn-border); border-radius:0.9rem; padding:0.6rem 0.8rem">
                    <summary style="font-weight:700; font-size:0.85rem; cursor:pointer">${ICONS.portfolio} New portfolio item</summary>
                    <form id="portfolio-form" class="admin-form" style="margin-top:0.8rem">
                        <div class="form-row">
                            <div><label>Title</label><input name="title" placeholder="Project title" required /></div>
                            <div><label>Client</label><input name="client" placeholder="Client name" required /></div>
                        </div>
                        <div><label>Category</label><input name="category" placeholder="e.g. Banking & Finance" required /></div>
                        <div><label>Description</label><textarea name="description" placeholder="Short description"></textarea></div>
                        <div><label>Outcome</label><input name="outcome" placeholder="Measurable outcome" /></div>
                        <button class="btn-wn btn-wn-primary" type="submit">Save portfolio item</button>
                    </form>
                </details>
            </div>
        </div>

        <div class="admin-card">
            <div class="card-head">
                <h3>Services</h3>
                <div class="card-tools">
                    <a class="btn-wn btn-wn-secondary" href="/admin/records.html?type=services">View all ${ICONS.arrowRight}</a>
                </div>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr><th>Service</th><th>Category</th><th>Summary</th><th style="text-align:right">Actions</th></tr></thead>
                    <tbody id="services-body"></tbody>
                </table>
            </div>
        </div>

        <div class="admin-card">
            <div class="card-head">
                <h3>Recent inquiries</h3>
                <div class="card-tools">
                    <input id="inquiries-search" type="search" placeholder="Search…" style="min-width:200px; border:1px solid var(--wn-border); border-radius:0.8rem; padding:0.55rem 0.8rem; font:inherit" />
                    <select id="inquiries-status-filter" style="border:1px solid var(--wn-border); border-radius:0.8rem; padding:0.55rem 0.7rem; font:inherit">
                        <option value="all">All statuses</option>
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="resolved">Resolved</option>
                    </select>
                    <button id="export-inquiries-btn" class="btn-wn btn-wn-secondary" type="button">${ICONS.download} Export</button>
                </div>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Service</th><th>Status</th><th style="text-align:right">Action</th></tr></thead>
                    <tbody id="inquiries-body"></tbody>
                </table>
            </div>
        </div>

        <div class="admin-card">
            <div class="card-head">
                <h3>Upcoming consultations</h3>
                <div class="card-tools">
                    <input id="consultations-search" type="search" placeholder="Search…" style="min-width:200px; border:1px solid var(--wn-border); border-radius:0.8rem; padding:0.55rem 0.8rem; font:inherit" />
                    <select id="consultations-status-filter" style="border:1px solid var(--wn-border); border-radius:0.8rem; padding:0.55rem 0.7rem; font:inherit">
                        <option value="all">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <button id="export-consultations-btn" class="btn-wn btn-wn-secondary" type="button">${ICONS.download} Export</button>
                </div>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr><th>Name</th><th>Preferred</th><th>Time</th><th>Status</th><th style="text-align:right">Action</th></tr></thead>
                    <tbody id="consultations-body"></tbody>
                </table>
            </div>
        </div>

        <div class="admin-card">
            <div class="card-head">
                <h3>Portfolio</h3>
                <div class="card-tools">
                    <a class="btn-wn btn-wn-secondary" href="/admin/records.html?type=portfolio">View all ${ICONS.arrowRight}</a>
                </div>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr><th>Title</th><th>Client</th><th>Category</th><th style="text-align:right">Actions</th></tr></thead>
                    <tbody id="portfolio-body"></tbody>
                </table>
            </div>
        </div>`;
}

function statCard(key, label, id, color, iconKey) {
    return `
        <div class="stat-card" style="--stat-color:${color}">
            <div class="stat-icon">${ICONS[iconKey] || ''}</div>
            <span class="stat-label">${label}</span>
            <div class="stat-value" id="${id}">0</div>
        </div>`;
}

function getFilteredItems(items, searchSelector, statusSelector, valueFields = []) {
    const searchInput = document.getElementById(searchSelector);
    const statusInput = document.getElementById(statusSelector);
    if (!searchInput || !statusInput) return items;
    const searchValue = searchInput.value.toLowerCase();
    const statusValue = statusInput.value;
    return items.filter((item) => {
        const matchesSearch = !searchValue || valueFields.map((field) => String(item[field] || '')).join(' ').toLowerCase().includes(searchValue);
        const matchesStatus = statusValue === 'all' || item.status === statusValue;
        return matchesSearch && matchesStatus;
    });
}

function downloadCsv(filename, rows) {
    if (!rows.length) rows = [{ empty: 'No records' }];
    const headers = Object.keys(rows[0]);
    const csvRows = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))];
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

async function loadDashboard() {
    try {
        const [stats, services, inquiries, consultations, portfolio, workers, notifications] = await Promise.all([
            authApi('/api/admin/stats'),
            authApi('/api/services'),
            authApi('/api/inquiries'),
            authApi('/api/consultations'),
            authApi('/api/portfolio'),
            authApi('/api/admin/workers'),
            authApi('/api/admin/notifications')
        ]);

        const statMap = {
            'stats-services': stats.services,
            'stats-inquiries': stats.inquiries,
            'stats-consultations': stats.consultations,
            'stats-portfolio': stats.portfolio,
            'stats-workers': stats.workers,
            'stats-notifications': stats.notifications || 0
        };
        Object.keys(statMap).forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = statMap[id];
        });
        const label = document.getElementById('stats-workers-label');
        if (label) label.textContent = `${stats.workers} member${stats.workers === 1 ? '' : 's'}`;

        renderInquiryChart(inquiries);
        renderActivityFeed(notifications);
        renderTeamRoster(workers);

        document.getElementById('services-body').innerHTML = services.length
            ? services.map((service) => `
                <tr>
                    <td class="cell-strong">${escapeHtml(service.name)}</td>
                    <td><span class="status-pill new">${escapeHtml(service.category)}</span></td>
                    <td class="cell-muted">${escapeHtml(service.summary)}</td>
                    <td style="text-align:right">
                        <div style="display:flex; gap:0.5rem; justify-content:flex-end">
                            <button class="btn-wn btn-wn-ghost" data-edit-service="${service.id}">Edit</button>
                            <button class="btn-wn btn-wn-danger" data-delete-service="${service.id}">Delete</button>
                        </div>
                    </td>
                </tr>`).join('')
            : '<tr><td colspan="4" class="cell-muted">No services yet.</td></tr>';

        const filteredInquiries = getFilteredItems(inquiries, 'inquiries-search', 'inquiries-status-filter', ['name', 'email', 'service_type', 'status']);
        document.getElementById('inquiries-body').innerHTML = filteredInquiries.length
            ? filteredInquiries.slice(0, 8).map((item) => `
                <tr>
                    <td class="cell-strong">${escapeHtml(item.name)}</td>
                    <td class="cell-muted">${escapeHtml(item.email)}</td>
                    <td>${escapeHtml(item.service_type)}</td>
                    <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
                    <td style="text-align:right">
                        <div style="display:flex; gap:0.4rem; justify-content:flex-end; align-items:center">
                            <select data-status-select="inquiry-${item.id}" style="border:1px solid var(--wn-border); border-radius:0.7rem; padding:0.4rem 0.5rem; font:inherit; font-size:0.8rem">
                                <option value="new" ${item.status === 'new' ? 'selected' : ''}>New</option>
                                <option value="contacted" ${item.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                                <option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                            </select>
                            <button class="btn-wn btn-wn-secondary" data-update-inquiry="${item.id}">Save</button>
                        </div>
                    </td>
                </tr>`).join('')
            : '<tr><td colspan="5" class="cell-muted">No matching inquiries.</td></tr>';

        const filteredConsultations = getFilteredItems(consultations, 'consultations-search', 'consultations-status-filter', ['name', 'email', 'preferred_date', 'preferred_time', 'status']);
        document.getElementById('consultations-body').innerHTML = filteredConsultations.length
            ? filteredConsultations.slice(0, 8).map((item) => `
                <tr>
                    <td class="cell-strong">${escapeHtml(item.name)}</td>
                    <td class="cell-muted">${escapeHtml(item.preferred_date)}</td>
                    <td class="cell-muted">${escapeHtml(item.preferred_time)}</td>
                    <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
                    <td style="text-align:right">
                        <div style="display:flex; gap:0.4rem; justify-content:flex-end; align-items:center">
                            <select data-status-select="consultation-${item.id}" style="border:1px solid var(--wn-border); border-radius:0.7rem; padding:0.4rem 0.5rem; font:inherit; font-size:0.8rem">
                                <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                                <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                            <button class="btn-wn btn-wn-secondary" data-update-consultation="${item.id}">Save</button>
                        </div>
                    </td>
                </tr>`).join('')
            : '<tr><td colspan="5" class="cell-muted">No matching consultations.</td></tr>';

        document.getElementById('portfolio-body').innerHTML = portfolio.length
            ? portfolio.map((item) => `
                <tr>
                    <td class="cell-strong">${escapeHtml(item.title)}</td>
                    <td class="cell-muted">${escapeHtml(item.client)}</td>
                    <td><span class="status-pill new">${escapeHtml(item.category)}</span></td>
                    <td style="text-align:right"><button class="btn-wn btn-wn-danger" data-delete-portfolio="${item.id}">Delete</button></td>
                </tr>`).join('')
            : '<tr><td colspan="4" class="cell-muted">No portfolio items yet.</td></tr>';

        wireDashboardEvents(services, workers);
        loadNotifications();
    } catch (error) {
        showToast(error.message);
    }
}

function renderInquiryChart(inquiries) {
    const chart = document.getElementById('inquiry-chart');
    if (!chart) return;
    const counts = {};
    inquiries.forEach((inquiry) => {
        const key = inquiry.service_type || 'Other';
        counts[key] = (counts[key] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!entries.length) {
        chart.innerHTML = '<p class="cell-muted">No inquiries recorded yet.</p>';
        return;
    }
    const max = Math.max(...entries.map(([, count]) => count), 1);
    chart.innerHTML = entries.map(([label, count]) => `
        <div class="bar-row">
            <span class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
            <span class="bar-value">${count}</span>
        </div>`).join('');
}

function renderActivityFeed(notifications) {
    const feed = document.getElementById('activity-feed');
    if (!feed) return;
    feed.innerHTML = notifications.length
        ? notifications.slice(0, 6).map((n) => `
            <div class="activity-item ${n.type === 'consultation' ? 'consultation' : 'inquiry'}">
                <div class="activity-dot"></div>
                <div class="activity-body">
                    <strong>${escapeHtml(n.title)}</strong>
                    <p>${escapeHtml(n.message)}</p>
                    <p style="font-size:0.72rem; color:var(--wn-slate-400); font-weight:600">${escapeHtml(formatRelativeTime(n.createdAt))}</p>
                </div>
            </div>`).join('')
        : '<p class="cell-muted">No recent activity.</p>';
}

function renderTeamRoster(workers) {
    const roster = document.getElementById('team-roster');
    if (!roster) return;
    roster.innerHTML = workers.length
        ? workers.map((worker) => `
            <div class="roster-card">
                <div class="roster-name">
                    <span class="avatar" style="width:30px; height:30px; font-size:0.7rem; background:linear-gradient(135deg,#0ea5e9,#2563eb)">${escapeHtml(getInitials(worker.name))}</span>
                    ${escapeHtml(worker.name)}
                </div>
                <p class="roster-meta">${escapeHtml(worker.department)} · ${escapeHtml(worker.role)}</p>
                <button class="btn-wn btn-wn-danger" type="button" data-delete-worker="${worker.id}" style="padding:0.35rem 0.7rem; font-size:0.76rem">Remove</button>
            </div>`).join('')
        : '<p class="cell-muted">No team members yet.</p>';
}

function wireDashboardEvents(services, workers) {
    document.querySelectorAll('[data-mark-notification]').forEach((button) => {
        button.addEventListener('click', async () => {
            await authApi(`/api/admin/notifications/${button.getAttribute('data-mark-notification')}/read`, { method: 'PUT' });
            loadNotifications();
        });
    });
    document.querySelectorAll('[data-delete-worker]').forEach((button) => {
        button.addEventListener('click', async () => {
            await authApi(`/api/admin/workers/${button.getAttribute('data-delete-worker')}`, { method: 'DELETE' });
            showToast('Worker removed; assigned consultations unassigned');
            loadDashboard();
        });
    });
    document.querySelectorAll('[data-edit-service]').forEach((button) => {
        button.addEventListener('click', () => {
            const service = services.find((entry) => entry.id === button.getAttribute('data-edit-service'));
            if (service) populateServiceForm(service);
        });
    });
    document.querySelectorAll('[data-delete-service]').forEach((button) => {
        button.addEventListener('click', async () => {
            await authApi(`/api/services/${button.getAttribute('data-delete-service')}`, { method: 'DELETE' });
            showToast('Service deleted');
            loadDashboard();
        });
    });
    document.querySelectorAll('[data-delete-portfolio]').forEach((button) => {
        button.addEventListener('click', async () => {
            await authApi(`/api/portfolio/${button.getAttribute('data-delete-portfolio')}`, { method: 'DELETE' });
            showToast('Portfolio item deleted');
            loadDashboard();
        });
    });
    document.querySelectorAll('[data-update-inquiry]').forEach((button) => {
        button.addEventListener('click', async () => {
            const inquiryId = button.getAttribute('data-update-inquiry');
            const select = document.querySelector(`[data-status-select="inquiry-${inquiryId}"]`);
            if (!select) return;
            await authApi(`/api/inquiries/${inquiryId}`, { method: 'PUT', body: JSON.stringify({ status: select.value }) });
            showToast('Inquiry status updated');
            loadDashboard();
        });
    });
    document.querySelectorAll('[data-update-consultation]').forEach((button) => {
        button.addEventListener('click', async () => {
            const consultationId = button.getAttribute('data-update-consultation');
            const select = document.querySelector(`[data-status-select="consultation-${consultationId}"]`);
            if (!select) return;
            await authApi(`/api/consultations/${consultationId}`, { method: 'PUT', body: JSON.stringify({ status: select.value }) });
            showToast('Consultation updated');
            loadDashboard();
        });
    });
}

/* ---------------- Records page ---------------- */

async function renderRecordsPage(type) {
    const content = document.getElementById('admin-content');
    if (!content) return;
    content.innerHTML = '<div class="admin-card"><p class="cell-muted">Loading records…</p></div>';

    const labels = { services: 'Services', inquiries: 'Inquiries', consultations: 'Consultations', portfolio: 'Portfolio' };
    const subtitle = `Full ${type} records with status updates and detailed information.`;

    try {
        if (type === 'services') {
            const services = await authApi('/api/services');
            content.innerHTML = `
                <div class="admin-card">
                    <div class="card-head">
                        <h3>${labels.services}</h3>
                        <div class="card-tools"><a class="btn-wn btn-wn-primary" href="/admin/dashboard.html">${ICONS.plus} New service</a></div>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Service</th><th>Category</th><th>Summary</th><th>Deliverables</th><th>Price</th><th>Actions</th></tr></thead>
                            <tbody>
                                ${services.length ? services.map((service) => `
                                    <tr>
                                        <td class="cell-strong">${escapeHtml(service.name)}</td>
                                        <td><span class="status-pill new">${escapeHtml(service.category)}</span></td>
                                        <td class="cell-muted">${escapeHtml(service.summary)}</td>
                                        <td class="cell-muted">${escapeHtml(service.deliverables || '—')}</td>
                                        <td class="cell-muted">${escapeHtml(service.priceRange || '—')}</td>
                                        <td><button class="btn-wn btn-wn-danger" data-delete-service="${service.id}">Delete</button></td>
                                    </tr>`).join('') : '<tr><td colspan="6" class="cell-muted">No services yet.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            document.querySelectorAll('[data-delete-service]').forEach((button) => {
                button.addEventListener('click', async () => {
                    await authApi(`/api/services/${button.getAttribute('data-delete-service')}`, { method: 'DELETE' });
                    showToast('Service deleted');
                    renderRecordsPage(type);
                });
            });
        } else if (type === 'inquiries') {
            const inquiries = await authApi('/api/inquiries');
            content.innerHTML = `
                <div class="admin-card">
                    <div class="card-head">
                        <h3>${labels.inquiries}</h3>
                        <button class="btn-wn btn-wn-secondary" id="export-records" type="button">${ICONS.download} Export CSV</button>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Name</th><th>Contact</th><th>Service</th><th>Message</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>
                                ${inquiries.length ? inquiries.map((item) => `
                                    <tr>
                                        <td class="cell-strong">${escapeHtml(item.name)}</td>
                                        <td class="cell-muted">${escapeHtml(item.email)}<br/>${escapeHtml(item.phone)}</td>
                                        <td>${escapeHtml(item.service_type)}</td>
                                        <td class="cell-muted" style="max-width:260px">${escapeHtml(item.message)}</td>
                                        <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
                                        <td>
                                            <div style="display:flex; gap:0.4rem; align-items:center">
                                                <select data-status-select="inquiry-${item.id}" style="border:1px solid var(--wn-border); border-radius:0.7rem; padding:0.4rem 0.5rem; font:inherit; font-size:0.8rem">
                                                    <option value="new" ${item.status === 'new' ? 'selected' : ''}>New</option>
                                                    <option value="contacted" ${item.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                                                    <option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                                                </select>
                                                <button class="btn-wn btn-wn-secondary" data-update-inquiry="${item.id}">Save</button>
                                            </div>
                                        </td>
                                    </tr>`).join('') : '<tr><td colspan="6" class="cell-muted">No inquiries yet.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            document.querySelectorAll('[data-update-inquiry]').forEach((button) => {
                button.addEventListener('click', async () => {
                    const inquiryId = button.getAttribute('data-update-inquiry');
                    const select = document.querySelector(`[data-status-select="inquiry-${inquiryId}"]`);
                    if (!select) return;
                    await authApi(`/api/inquiries/${inquiryId}`, { method: 'PUT', body: JSON.stringify({ status: select.value }) });
                    showToast('Inquiry status updated');
                    renderRecordsPage(type);
                });
            });
            document.getElementById('export-records').addEventListener('click', async () => {
                downloadCsv('inquiries.csv', inquiries.map((item) => ({ name: item.name, email: item.email, phone: item.phone, service_type: item.service_type, status: item.status, createdAt: item.createdAt })));
            });
        } else if (type === 'consultations') {
            const [consultations, workers] = await Promise.all([authApi('/api/consultations'), authApi('/api/admin/workers')]);
            const departmentOptions = [...new Set(workers.map((worker) => worker.department))].sort();
            content.innerHTML = `
                <div class="admin-card">
                    <div class="card-head">
                        <h3>${labels.consultations}</h3>
                        <button class="btn-wn btn-wn-secondary" id="export-records" type="button">${ICONS.download} Export CSV</button>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Requester</th><th>Preferred</th><th>Notes</th><th>Assigned</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>
                                ${consultations.length ? consultations.map((item) => `
                                    <tr>
                                        <td class="cell-strong">${escapeHtml(item.name)}<br/><span class="cell-muted">${escapeHtml(item.email)} · ${escapeHtml(item.phone)}</span></td>
                                        <td class="cell-muted">${escapeHtml(item.preferred_date)} @ ${escapeHtml(item.preferred_time)}</td>
                                        <td class="cell-muted" style="max-width:220px">${escapeHtml(item.notes || '—')}</td>
                                        <td class="cell-muted">${escapeHtml(item.assignedDepartment || '—')} / ${escapeHtml(item.assignedWorker || '—')}</td>
                                        <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
                                        <td>
                                            <div style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap; min-width:240px">
                                                <select data-status-select="consultation-${item.id}" style="border:1px solid var(--wn-border); border-radius:0.7rem; padding:0.4rem 0.5rem; font:inherit; font-size:0.8rem">
                                                    <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
                                                    <option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                                                    <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option>
                                                    <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                                                </select>
                                                <select data-department-select="consultation-${item.id}" style="border:1px solid var(--wn-border); border-radius:0.7rem; padding:0.4rem 0.5rem; font:inherit; font-size:0.8rem">
                                                    <option value="">Dept</option>
                                                    ${departmentOptions.map((department) => `<option value="${escapeHtml(department)}" ${item.assignedDepartment === department ? 'selected' : ''}>${escapeHtml(department)}</option>`).join('')}
                                                </select>
                                                <select data-worker-select="consultation-${item.id}" style="border:1px solid var(--wn-border); border-radius:0.7rem; padding:0.4rem 0.5rem; font:inherit; font-size:0.8rem">
                                                    <option value="">Worker</option>
                                                    ${workers.map((worker) => `<option value="${escapeHtml(worker.name)}" ${item.assignedWorker === worker.name ? 'selected' : ''}>${escapeHtml(worker.name)}</option>`).join('')}
                                                </select>
                                                <button class="btn-wn btn-wn-secondary" data-update-consultation="${item.id}">Save</button>
                                            </div>
                                        </td>
                                    </tr>`).join('') : '<tr><td colspan="6" class="cell-muted">No consultations yet.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="admin-card">
                    <div class="card-head"><h3>Team roster</h3><span class="cell-muted">Assign to a department and worker</span></div>
                    <div class="roster-grid">
                        ${workers.map((worker) => `
                            <div class="roster-card">
                                <div class="roster-name"><span class="avatar" style="width:30px; height:30px; font-size:0.7rem; background:linear-gradient(135deg,#0ea5e9,#2563eb)">${escapeHtml(getInitials(worker.name))}</span>${escapeHtml(worker.name)}</div>
                                <p class="roster-meta">${escapeHtml(worker.department)} · ${escapeHtml(worker.role)}</p>
                            </div>`).join('')}
                    </div>
                </div>`;
            document.querySelectorAll('[data-update-consultation]').forEach((button) => {
                button.addEventListener('click', async () => {
                    const consultationId = button.getAttribute('data-update-consultation');
                    const statusSelect = document.querySelector(`[data-status-select="consultation-${consultationId}"]`);
                    const departmentSelect = document.querySelector(`[data-department-select="consultation-${consultationId}"]`);
                    const workerSelect = document.querySelector(`[data-worker-select="consultation-${consultationId}"]`);
                    if (!statusSelect) return;
                    await authApi(`/api/consultations/${consultationId}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            status: statusSelect.value,
                            assignedDepartment: departmentSelect ? departmentSelect.value : '',
                            assignedWorker: workerSelect ? workerSelect.value : ''
                        })
                    });
                    showToast('Consultation updated');
                    renderRecordsPage(type);
                });
            });
            document.getElementById('export-records').addEventListener('click', async () => {
                downloadCsv('consultations.csv', consultations.map((item) => ({ name: item.name, email: item.email, phone: item.phone, preferred_date: item.preferred_date, preferred_time: item.preferred_time, status: item.status, assignedDepartment: item.assignedDepartment, assignedWorker: item.assignedWorker })));
            });
        } else if (type === 'portfolio') {
            const portfolio = await authApi('/api/portfolio');
            content.innerHTML = `
                <div class="admin-card">
                    <div class="card-head">
                        <h3>${labels.portfolio}</h3>
                        <div class="card-tools"><a class="btn-wn btn-wn-primary" href="/admin/dashboard.html">${ICONS.plus} New portfolio item</a></div>
                    </div>
                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead><tr><th>Title</th><th>Client</th><th>Category</th><th>Outcome</th><th>Actions</th></tr></thead>
                            <tbody>
                                ${portfolio.length ? portfolio.map((item) => `
                                    <tr>
                                        <td class="cell-strong">${escapeHtml(item.title)}</td>
                                        <td class="cell-muted">${escapeHtml(item.client)}</td>
                                        <td><span class="status-pill new">${escapeHtml(item.category)}</span></td>
                                        <td class="cell-muted">${escapeHtml(item.outcome || '—')}</td>
                                        <td><button class="btn-wn btn-wn-danger" data-delete-portfolio="${item.id}">Delete</button></td>
                                    </tr>`).join('') : '<tr><td colspan="5" class="cell-muted">No portfolio items yet.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            document.querySelectorAll('[data-delete-portfolio]').forEach((button) => {
                button.addEventListener('click', async () => {
                    await authApi(`/api/portfolio/${button.getAttribute('data-delete-portfolio')}`, { method: 'DELETE' });
                    showToast('Portfolio item deleted');
                    renderRecordsPage(type);
                });
            });
        }
    } catch (error) {
        content.innerHTML = `<div class="admin-card"><p class="cell-muted">${escapeHtml(error.message)}</p></div>`;
    }
}

/* ---------------- Workers ---------------- */

function showCredentialsModal(title, staffId, password) {
    const overlay = document.createElement('div');
    overlay.className = 'credential-overlay';
    overlay.innerHTML = `
        <div class="credential-modal">
            <button type="button" class="credential-close" aria-label="Close">&times;</button>
            <h3>${escapeHtml(title)}</h3>
            <p class="cell-muted">Share these sign-in details with the user — Staff ID + password, like a Sakai login.</p>
            <div class="credential-row"><span>Staff ID</span><strong>${escapeHtml(staffId || '')}</strong></div>
            <div class="credential-row"><span>Password</span><strong>${escapeHtml(password || '')}</strong></div>
            <p class="cell-muted" style="font-size:0.78rem">The password is temporary — it is cleared after their first sign-in. Reset it any time from the list.</p>
            <button class="btn-wn btn-wn-primary" type="button" id="credential-copy">Copy credentials</button>
        </div>`;
    const close = () => overlay.remove();
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close();
    });
    const closeButton = overlay.querySelector('.credential-close');
    if (closeButton) closeButton.addEventListener('click', close);
    const copyButton = overlay.querySelector('#credential-copy');
    if (copyButton) {
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(`Staff ID: ${staffId || ''}\nPassword: ${password || ''}`);
                showToast('Credentials copied to clipboard');
            } catch {
                showToast('Copy failed — select and copy manually.');
            }
        });
    }
    document.body.appendChild(overlay);
}

async function renderWorkersPage() {
    const content = document.getElementById('admin-content');
    try {
        const [workers, consultations, users] = await Promise.all([
            authApi('/api/admin/workers'),
            authApi('/api/consultations'),
            authApi('/api/admin/users')
        ]);
        const departmentOptions = [...new Set(workers.map((worker) => worker.department))].sort();
        content.innerHTML = `
            <div class="admin-card">
                <div class="card-head">
                    <h3>Workers</h3>
                    <span class="cell-muted">${workers.length} member${workers.length === 1 ? '' : 's'}</span>
                </div>
                <details class="worker-add-panel" style="margin-bottom:1rem">
                    <summary style="font-weight:700; font-size:0.85rem; cursor:pointer">+ Add team member</summary>
                    <form class="admin-form" id="worker-form" style="margin-top:0.9rem">
                        <div class="form-row">
                            <div>
                                <label>Type of access</label>
                                <select name="userType" id="worker-user-type">
                                    <option value="staff">Staff (view assigned work)</option>
                                    <option value="admin">Admin (full console access)</option>
                                </select>
                            </div>
                            <div><label>Name</label><input name="name" placeholder="e.g. Adjoa Mensah" required /></div>
                        </div>
                        <div class="form-row">
                            <div><label>Email (for login)</label><input name="email" type="email" placeholder="worker@worldnetict.com" /></div>
                            <div><label>Password</label><input name="password" type="password" placeholder="Admin: 8+ chars · Staff: 6+ chars" /></div>
                        </div>
                        <div class="form-row" id="worker-only-fields">
                            <div><label>Department</label><input name="department" list="department-list" placeholder="e.g. Infrastructure" required /></div>
                            <div><label>Role</label><input name="role" placeholder="e.g. Network Engineer" required /></div>
                        </div>
                        <datalist id="department-list">${departmentOptions.map((department) => `<option value="${escapeHtml(department)}"></option>`).join('')}</datalist>
                        <button class="btn-wn btn-wn-primary" type="submit">Add team member</button>
                    </form>
                </details>
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead><tr><th>Staff ID</th><th>Worker</th><th>Email</th><th>Department</th><th>Role</th><th>Assignments</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${workers.length ? workers.map((worker) => {
                                const workerAssignments = consultations.filter((item) => item.assignedWorker === worker.name);
                                return `
                                <tr>
                                    <td class="cell-strong">${escapeHtml(worker.id)}</td>
                                    <td class="cell-strong">${escapeHtml(worker.name)}</td>
                                    <td class="cell-muted">${escapeHtml(worker.email || '—')}</td>
                                    <td class="cell-muted">${escapeHtml(worker.department)}</td>
                                    <td class="cell-muted">${escapeHtml(worker.role)}</td>
                                    <td><span class="status-pill ${workerAssignments.length ? 'contacted' : ''}">${workerAssignments.length} assignment${workerAssignments.length === 1 ? '' : 's'}</span></td>
                                    <td>
                                        <div style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap">
                                            <button class="btn-wn btn-wn-secondary" data-worker-password="${worker.id}" title="View or reset password">Password</button>
                                            <button class="btn-wn btn-wn-secondary" data-view-assignments="${worker.id}">View</button>
                                            <button class="btn-wn btn-wn-secondary" data-edit-worker="${worker.id}">Edit</button>
                                            <button class="btn-wn btn-wn-danger" data-delete-worker="${worker.id}">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                                <tr class="assignments-row" id="assignments-${worker.id}" style="display:none">
                                    <td colspan="7">
                                        <div class="worker-assignments">
                                            ${workerAssignments.length ? workerAssignments.map((item) => `
                                                <div class="assignment-item">
                                                    <div><strong>${escapeHtml(item.name)}</strong><span class="cell-muted"> · ${escapeHtml(item.company || '—')}</span></div>
                                                    <div class="cell-muted">${escapeHtml(item.preferred_date)} @ ${escapeHtml(item.preferred_time)}</div>
                                                    <span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span>
                                                </div>`).join('') : '<p class="cell-muted">No assignments.</p>'}
                                        </div>
                                    </td>
                                </tr>`;
                            }).join('') : '<tr><td colspan="7" class="cell-muted">No team members yet.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="admin-card" id="edit-worker-card" style="display:none">
                <div class="card-head"><h3>Edit worker</h3><span class="cell-muted" id="edit-worker-name"></span></div>
                <form class="admin-form" id="worker-edit-form">
                    <div class="form-row">
                        <div><label>Name</label><input name="name" required /></div>
                        <div><label>Email (for login)</label><input name="email" type="email" /></div>
                        <div><label>New password (optional)</label><input name="password" type="password" placeholder="Leave blank to keep current" /></div>
                    </div>
                    <div class="form-row">
                        <div><label>Department</label><input name="department" list="department-list" required /></div>
                        <div><label>Role</label><input name="role" required /></div>
                    </div>
                    <div style="display:flex; gap:0.5rem">
                        <button class="btn-wn btn-wn-primary" type="submit">Save changes</button>
                        <button class="btn-wn btn-wn-ghost" type="button" id="cancel-edit-worker">Cancel</button>
                    </div>
                </form>
            </div>
            <div class="admin-card">
                <div class="card-head">
                    <h3>System users</h3>
                    <span class="cell-muted">${users.length} with console access</span>
                </div>
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead><tr><th>Staff ID</th><th>Name</th><th>Email</th><th>Access</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${users.map((user) => `
                                <tr>
                                    <td class="cell-strong">${escapeHtml(user.id)}</td>
                                    <td class="cell-strong">${escapeHtml(user.name)}</td>
                                    <td class="cell-muted">${escapeHtml(user.email)}</td>
                                    <td><span class="status-pill contacted">Admin</span></td>
                                    <td>
                                        <div style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap">
                                            <button class="btn-wn btn-wn-secondary" data-user-password="${escapeHtml(user.id)}" title="View or reset password">Password</button>
                                            <button class="btn-wn btn-wn-danger" data-delete-user="${escapeHtml(user.id)}">Remove access</button>
                                        </div>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;

        document.getElementById('worker-user-type').addEventListener('change', (event) => {
            const isAdmin = event.target.value === 'admin';
            document.getElementById('worker-only-fields').style.display = isAdmin ? 'none' : '';
            const button = document.getElementById('worker-form').querySelector('button[type="submit"]');
            if (button) button.textContent = isAdmin ? 'Create admin user' : 'Add team member';
        });

        document.getElementById('worker-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const payload = Object.fromEntries(new FormData(form).entries());
            const isAdmin = payload.userType === 'admin';
            delete payload.userType;
            if (isAdmin) delete payload.department;
            try {
                if (isAdmin) {
                    const data = await authApi('/api/admin/users', {
                        method: 'POST',
                        body: JSON.stringify({ name: payload.name, email: payload.email, password: payload.password })
                    });
                    showToast('Admin user created');
                    showCredentialsModal('New admin user', data.admin.id, data.admin.tempPassword);
                } else {
                    const data = await authApi('/api/admin/workers', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    showToast('Worker added');
                    showCredentialsModal('New team member', data.id, data.tempPassword);
                }
                renderWorkersPage();
            } catch (error) {
                showToast(error.message);
            }
        });

        document.querySelectorAll('[data-worker-password]').forEach((button) => {
            button.addEventListener('click', async () => {
                const worker = workers.find((item) => item.id === button.getAttribute('data-worker-password'));
                if (!worker) return;
                try {
                    if (worker.tempPassword) {
                        showCredentialsModal(worker.name, worker.id, worker.tempPassword);
                    } else {
                        if (!confirm(`${worker.name} has no viewable password (already used). Generate a new temporary password?`)) return;
                        const data = await authApi(`/api/admin/workers/${worker.id}/reset-password`, { method: 'POST' });
                        showCredentialsModal(worker.name, worker.id, data.password);
                        renderWorkersPage();
                    }
                } catch (error) {
                    showToast(error.message);
                }
            });
        });

        document.querySelectorAll('[data-user-password]').forEach((button) => {
            button.addEventListener('click', async () => {
                const user = users.find((item) => item.id === button.getAttribute('data-user-password'));
                if (!user) return;
                try {
                    if (user.tempPassword) {
                        showCredentialsModal(user.name, user.id, user.tempPassword);
                    } else {
                        if (!confirm(`${user.name} has no viewable password (already used). Generate a new temporary password?`)) return;
                        const data = await authApi(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' });
                        showCredentialsModal(user.name, user.id, data.password);
                        renderWorkersPage();
                    }
                } catch (error) {
                    showToast(error.message);
                }
            });
        });

        document.querySelectorAll('[data-delete-user]').forEach((button) => {
            button.addEventListener('click', async () => {
                const id = button.getAttribute('data-delete-user');
                const target = users.find((user) => user.id === id);
                if (!confirm(`Remove console access for ${target ? target.name : 'this user'}? They will no longer be able to sign in.`)) return;
                try {
                    await authApi(`/api/admin/users/${id}`, { method: 'DELETE' });
                    showToast('Access removed');
                    renderWorkersPage();
                } catch (error) {
                    showToast(error.message);
                }
            });
        });

        document.querySelectorAll('[data-view-assignments]').forEach((button) => {
            button.addEventListener('click', () => {
                const row = document.getElementById(`assignments-${button.getAttribute('data-view-assignments')}`);
                if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
            });
        });

        document.querySelectorAll('[data-edit-worker]').forEach((button) => {
            button.addEventListener('click', () => {
                const worker = workers.find((item) => item.id === button.getAttribute('data-edit-worker'));
                if (!worker) return;
                const card = document.getElementById('edit-worker-card');
                const form = document.getElementById('worker-edit-form');
                document.getElementById('edit-worker-name').textContent = worker.name;
                form.dataset.workerId = worker.id;
                form.name.value = worker.name;
                form.email.value = worker.email || '';
                form.password.value = '';
                form.department.value = worker.department;
                form.role.value = worker.role;
                card.style.display = '';
                card.scrollIntoView({ behavior: 'smooth' });
            });
        });

        document.getElementById('worker-edit-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const payload = Object.fromEntries(new FormData(form).entries());
            delete payload.password;
            if (form.password.value.trim()) payload.password = form.password.value.trim();
            try {
                await authApi(`/api/admin/workers/${form.dataset.workerId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                showToast('Worker updated');
                renderWorkersPage();
            } catch (error) {
                showToast(error.message);
            }
        });

        document.getElementById('cancel-edit-worker').addEventListener('click', () => {
            document.getElementById('edit-worker-card').style.display = 'none';
        });

        document.querySelectorAll('[data-delete-worker]').forEach((button) => {
            button.addEventListener('click', async () => {
                if (!window.confirm('Delete this worker? Their assignments will be unassigned.')) return;
                await authApi(`/api/admin/workers/${button.getAttribute('data-delete-worker')}`, { method: 'DELETE' });
                showToast('Worker deleted');
                renderWorkersPage();
            });
        });
    } catch (error) {
        content.innerHTML = `<div class="admin-card"><p class="cell-muted">${escapeHtml(error.message)}</p></div>`;
    }
}

/* ---------------- Departments ---------------- */

async function renderDepartmentsPage() {
    const content = document.getElementById('admin-content');
    try {
        const [departments, consultations, workers] = await Promise.all([
            authApi('/api/admin/departments'),
            authApi('/api/consultations'),
            authApi('/api/admin/workers')
        ]);
        const unassigned = consultations.filter((item) => !item.assignedDepartment);
        content.innerHTML = `
            <div class="dept-stats">
                <div class="stat-card"><strong>${departments.length}</strong><span>Departments</span></div>
                <div class="stat-card"><strong>${workers.length}</strong><span>Total workers</span></div>
                <div class="stat-card"><strong>${unassigned.length}</strong><span>Unassigned consultations</span></div>
            </div>
            <div class="dept-grid">
                ${departments.length ? departments.map((department) => {
                    const departmentWorkers = department.workers;
                    const departmentConsultations = consultations.filter((item) => item.assignedDepartment === department.department);
                    return `
                    <div class="admin-card dept-card">
                        <div class="card-head">
                            <div>
                                <h3>${escapeHtml(department.department)}</h3>
                                <span class="cell-muted">${departmentWorkers.length} worker${departmentWorkers.length === 1 ? '' : 's'} · ${department.consultationCount} assigned consultation${department.consultationCount === 1 ? '' : 's'}</span>
                            </div>
                        </div>
                        <div class="dept-roster">
                            ${departmentWorkers.length ? departmentWorkers.map((worker) => `
                                <div class="roster-card">
                                    <div class="roster-name"><span class="avatar" style="width:30px; height:30px; font-size:0.7rem; background:linear-gradient(135deg,#0ea5e9,#2563eb)">${escapeHtml(getInitials(worker.name))}</span>${escapeHtml(worker.name)}</div>
                                    <p class="roster-meta">${escapeHtml(worker.role)}</p>
                                </div>`).join('') : '<p class="cell-muted">No workers in this department.</p>'}
                        </div>
                        <div style="margin-top:1rem; border-top:1px solid var(--wn-border); padding-top:0.9rem">
                            <p style="font-size:0.8rem; font-weight:700; margin:0 0 0.6rem">Assign consultation</p>
                            ${departmentConsultations.length && departmentWorkers.length ? `
                            <div style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap">
                                <select data-assign-select="consultation" style="border:1px solid var(--wn-border); border-radius:0.7rem; padding:0.4rem 0.5rem; font:inherit; font-size:0.8rem">
                                    ${departmentConsultations.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} — ${escapeHtml(item.preferred_date)} (${escapeHtml(item.status)})</option>`).join('')}
                                </select>
                                <select data-assign-worker="consultation" style="border:1px solid var(--wn-border); border-radius:0.7rem; padding:0.4rem 0.5rem; font:inherit; font-size:0.8rem">
                                    ${departmentWorkers.map((worker) => `<option value="${escapeHtml(worker.name)}">${escapeHtml(worker.name)} (${escapeHtml(worker.role)})</option>`).join('')}
                                </select>
                                <button class="btn-wn btn-wn-secondary" data-assign-save="${department.department}">Assign</button>
                            </div>` : '<p class="cell-muted">No consultations routed to this department yet.</p>'}
                        </div>
                    </div>`;
                }).join('') : '<div class="admin-card"><p class="cell-muted">No departments yet.</p></div>'}
            </div>`;

        document.querySelectorAll('[data-assign-save]').forEach((button) => {
            button.addEventListener('click', async () => {
                const department = button.getAttribute('data-assign-save');
                const card = button.closest('.dept-card');
                const consultationSelect = card.querySelector('[data-assign-select="consultation"]');
                const workerSelect = card.querySelector('[data-assign-worker="consultation"]');
                if (!consultationSelect || !consultationSelect.value) return;
                await authApi(`/api/consultations/${consultationSelect.value}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        assignedDepartment: department,
                        assignedWorker: workerSelect.value
                    })
                });
                showToast('Consultation assigned');
                renderDepartmentsPage();
            });
        });
    } catch (error) {
        content.innerHTML = `<div class="admin-card"><p class="cell-muted">${escapeHtml(error.message)}</p></div>`;
    }
}

/* ---------------- Forms ---------------- */

function resetServiceForm() {
    const form = document.getElementById('service-form');
    if (!form) return;
    form.reset();
    const editId = document.getElementById('service-edit-id');
    const submit = document.getElementById('service-submit-btn');
    const cancel = document.getElementById('cancel-service-edit');
    if (editId) editId.value = '';
    if (submit) submit.textContent = 'Save service';
    if (cancel) cancel.style.display = 'none';
}

function populateServiceForm(service) {
    const form = document.getElementById('service-form');
    if (!form) return;
    document.getElementById('service-edit-id').value = service.id;
    form.querySelector('[name="name"]').value = service.name || '';
    form.querySelector('[name="category"]').value = service.category || '';
    form.querySelector('[name="summary"]').value = service.summary || '';
    form.querySelector('[name="description"]').value = service.description || '';
    form.querySelector('[name="icon"]').value = service.icon || '';
    form.querySelector('[name="priceRange"]').value = service.priceRange || '';
    document.getElementById('service-submit-btn').textContent = 'Update service';
    document.getElementById('cancel-service-edit').style.display = 'inline-flex';
}

function wireDashboardForms() {
    const serviceForm = document.getElementById('service-form');
    if (serviceForm) {
        serviceForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const payload = Object.fromEntries(new FormData(event.target).entries());
            const serviceId = payload.id;
            try {
                if (serviceId) {
                    await authApi(`/api/services/${serviceId}`, { method: 'PUT', body: JSON.stringify(payload) });
                    showToast('Service updated');
                } else {
                    await authApi('/api/services', { method: 'POST', body: JSON.stringify(payload) });
                    showToast('Service created');
                }
                resetServiceForm();
                loadDashboard();
            } catch (error) {
                showToast(error.message);
            }
        });
        const cancel = document.getElementById('cancel-service-edit');
        if (cancel) cancel.addEventListener('click', resetServiceForm);
    }

    const workerForm = document.getElementById('worker-form');
    if (workerForm) {
        workerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const payload = Object.fromEntries(new FormData(event.target).entries());
            try {
                const data = await authApi('/api/admin/workers', { method: 'POST', body: JSON.stringify(payload) });
                event.target.reset();
                showToast('Team member added');
                showCredentialsModal(data.name, data.id, data.tempPassword);
                loadDashboard();
            } catch (error) {
                showToast(error.message);
            }
        });
    }

    const portfolioForm = document.getElementById('portfolio-form');
    if (portfolioForm) {
        portfolioForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const payload = Object.fromEntries(new FormData(event.target).entries());
            try {
                await authApi('/api/portfolio', { method: 'POST', body: JSON.stringify(payload) });
                event.target.reset();
                showToast('Portfolio item added');
                loadDashboard();
            } catch (error) {
                showToast(error.message);
            }
        });
    }

    const inquiriesSearch = document.getElementById('inquiries-search');
    const inquiriesFilter = document.getElementById('inquiries-status-filter');
    if (inquiriesSearch) inquiriesSearch.addEventListener('input', loadDashboard);
    if (inquiriesFilter) inquiriesFilter.addEventListener('change', loadDashboard);

    const consultationsSearch = document.getElementById('consultations-search');
    const consultationsFilter = document.getElementById('consultations-status-filter');
    if (consultationsSearch) consultationsSearch.addEventListener('input', loadDashboard);
    if (consultationsFilter) consultationsFilter.addEventListener('change', loadDashboard);

    const exportInquiries = document.getElementById('export-inquiries-btn');
    if (exportInquiries) {
        exportInquiries.addEventListener('click', async () => {
            const inquiries = await authApi('/api/inquiries');
            const filtered = getFilteredItems(inquiries, 'inquiries-search', 'inquiries-status-filter', ['name', 'email', 'service_type', 'status']);
            downloadCsv('inquiries.csv', filtered.map((item) => ({ name: item.name, email: item.email, service_type: item.service_type, status: item.status, createdAt: item.createdAt })));
        });
    }

    const exportConsultations = document.getElementById('export-consultations-btn');
    if (exportConsultations) {
        exportConsultations.addEventListener('click', async () => {
            const consultations = await authApi('/api/consultations');
            const filtered = getFilteredItems(consultations, 'consultations-search', 'consultations-status-filter', ['name', 'email', 'preferred_date', 'preferred_time', 'status']);
            downloadCsv('consultations.csv', filtered.map((item) => ({ name: item.name, email: item.email, preferred_date: item.preferred_date, preferred_time: item.preferred_time, status: item.status, createdAt: item.createdAt })));
        });
    }
}

/* ---------------- Login / Auth ---------------- */

function wirePasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const input = document.getElementById(button.dataset.target);
            if (!input) return;
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            button.innerHTML = show ? ICONS.eyeOff : ICONS.eye;
            button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
            input.focus();
        });
    });
}

function storeAuth(data) {
    localStorage.setItem('worldnet_token', data.token);
    localStorage.setItem('worldnet_admin', JSON.stringify(data.admin || {}));
}

function storeWorkerAuth(data) {
    localStorage.setItem('worldnet_worker_token', data.token);
    localStorage.setItem('worldnet_worker_profile', JSON.stringify(data.worker || {}));
}

function redirectAfterAuth(message, destination = '/admin/dashboard.html') {
    showToast(message);
    setTimeout(() => {
        window.location.href = destination;
    }, 450);
}

function wireAuthTabs() {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (!tabLogin || !tabRegister) return;

    const activate = (showLogin) => {
        tabLogin.classList.toggle('active', showLogin);
        tabRegister.classList.toggle('active', !showLogin);
        if (loginForm) loginForm.classList.toggle('auth-hidden', !showLogin);
        if (registerForm) registerForm.classList.toggle('auth-hidden', showLogin);
    };
    tabLogin.addEventListener('click', () => activate(true));
    tabRegister.addEventListener('click', () => activate(false));
}

function wireLogin() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(loginForm).entries());
        const button = loginForm.querySelector('button[type="submit"]');
        if (button) { button.disabled = true; button.textContent = 'Signing in…'; }
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Login failed');
            if (data.role === 'worker') {
                storeWorkerAuth(data);
                redirectAfterAuth(`Welcome, ${(data.worker?.name || 'Team member').split(' ')[0]}!`, '/worker.html');
            } else {
                storeAuth(data);
                redirectAfterAuth(`Welcome, ${(data.admin?.name || 'Admin').split(' ')[0]}!`, '/admin/dashboard.html');
            }
        } catch (error) {
            if (button) { button.disabled = false; button.textContent = 'Sign in'; }
            showToast(error.message);
        }
    });
}

function wireRegister() {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(registerForm).entries());
        const button = registerForm.querySelector('button[type="submit"]');
        if (button) { button.disabled = true; button.textContent = 'Creating account…'; }
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Registration failed');
            storeAuth(data);
            redirectAfterAuth(`Welcome, ${data.admin?.name?.split(' ')[0] || 'Admin'}!`);
        } catch (error) {
            if (button) { button.disabled = false; button.textContent = 'Create account'; }
            showToast(error.message);
        }
    });
}

function wireForgotPassword() {
    const forgotForm = document.getElementById('forgot-form');
    if (!forgotForm) return;
    forgotForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(forgotForm).entries());
        const button = forgotForm.querySelector('button[type="submit"]');
        if (button) { button.disabled = true; button.textContent = 'Sending…'; }
        try {
            const res = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Something went wrong');
            const notice = document.getElementById('forgot-success');
            if (notice) {
                notice.classList.add('show');
                notice.innerHTML = `<p>${data.message || 'Reset link sent.'}</p>${data.devResetLink ? `<p style="margin-top:0.5rem;word-break:break-all"><a href="${data.devResetLink}" target="_blank" rel="noopener">Open reset link (dev mode — SMTP not configured)</a></p>` : ''}`;
            }
            if (button) { button.disabled = false; button.textContent = 'Send reset link'; }
            forgotForm.reset();
        } catch (error) {
            if (button) { button.disabled = false; button.textContent = 'Send reset link'; }
            showToast(error.message);
        }
    });
}

function wireResetPassword() {
    const resetForm = document.getElementById('reset-form');
    if (!resetForm) return;
    const token = new URLSearchParams(window.location.search).get('token');
    const tokenInput = document.getElementById('reset-token');
    if (tokenInput) tokenInput.value = token || '';
    if (!token) {
        showToast('This reset link is missing a token. Request a new one.');
    }
    resetForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(resetForm).entries());
        if (payload.password !== payload.confirm) {
            showToast('Passwords do not match.');
            return;
        }
        const button = resetForm.querySelector('button[type="submit"]');
        if (button) { button.disabled = true; button.textContent = 'Resetting…'; }
        try {
            const res = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: payload.token, password: payload.password })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Password reset failed');
            showToast(data.message || 'Password updated!');
            setTimeout(() => {
                window.location.href = '/admin/login.html';
            }, 900);
        } catch (error) {
            if (button) { button.disabled = false; button.textContent = 'Reset password'; }
            showToast(error.message);
        }
    });
}

function handleGoogleCredential(credential) {
    fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
    })
        .then((res) => res.json().catch(() => ({})))
        .then((data) => {
            if (!data.ok) throw new Error(data.error || 'Google sign-in failed');
            storeAuth(data);
            redirectAfterAuth(`Welcome, ${data.admin?.name?.split(' ')[0] || 'Admin'}!`);
        })
        .catch((error) => showToast(error.message));
}

function wireGoogleSignIn() {
    const googleContainer = document.getElementById('google-signin');
    if (!googleContainer) return;
    fetch('/api/auth/config')
        .then((res) => res.json().catch(() => ({})))
        .then((config) => {
            if (!config.googleClientId) {
                googleContainer.innerHTML = '<p class="auth-note">Google sign-in is not enabled on this server yet.</p>';
                return;
            }
            googleContainer.innerHTML = '<div id="g_id_onload" data-client_id="' + config.googleClientId + '" data-callback="onGoogleSignIn"></div><div class="g_id_signin" data-type="standard" data-shape="pill" data-theme="outline" data-text="continue_with" data-size="large"></div>';
            window.onGoogleSignIn = (response) => handleGoogleCredential(response.credential);
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            document.body.appendChild(script);
        })
        .catch(() => {
            googleContainer.innerHTML = '';
        });
}

/* ---------------- Router ---------------- */

function currentPageInfo() {
    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') || 'services';
    if (pathname === '/admin/dashboard.html') {
        return { key: 'dashboard', title: 'Dashboard', subtitle: 'Command center for WorldNet operations' };
    }
    if (pathname === '/admin/consultations.html') {
        return { key: 'consultations', title: 'Consultations', subtitle: 'Assign and track consultation requests' };
    }
    if (pathname === '/admin/workers.html') {
        return { key: 'workers', title: 'Workers', subtitle: 'Manage team members and view their assignments' };
    }
    if (pathname === '/admin/departments.html') {
        return { key: 'departments', title: 'Departments', subtitle: 'Departments, roles, and assignment routing' };
    }
    if (pathname === '/admin/records.html') {
        const titles = { services: 'Services', inquiries: 'Inquiries', consultations: 'Consultations', portfolio: 'Portfolio' };
        return { key: type, title: titles[type] || 'Records', subtitle: `Full ${type} records` };
    }
    return { key: 'dashboard', title: 'Admin', subtitle: '' };
}

function initAdmin() {
    if (!getToken()) {
        window.location.href = '/admin/login.html';
        return;
    }

    const page = currentPageInfo();
    const isDashboard = window.location.pathname === '/admin/dashboard.html';
    const isConsultationsPage = window.location.pathname === '/admin/consultations.html';
    const isRecordsPage = window.location.pathname === '/admin/records.html';
    const isWorkersPage = window.location.pathname === '/admin/workers.html';
    const isDepartmentsPage = window.location.pathname === '/admin/departments.html';

    renderShell(page.key, page.title, page.subtitle);
    const content = document.getElementById('admin-content');

    if (isDashboard) {
        content.innerHTML = buildDashboard(getAdminProfile());
        wireDashboardForms();
        loadDashboard();
    } else if (isConsultationsPage) {
        renderRecordsPage('consultations');
    } else if (isRecordsPage) {
        renderRecordsPage(page.key);
    } else if (isWorkersPage) {
        renderWorkersPage();
    } else if (isDepartmentsPage) {
        renderDepartmentsPage();
    }

    if (window.location.hash === '#team') {
        const teamSection = document.getElementById('team-roster');
        if (teamSection) teamSection.scrollIntoView({ behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    watchSystemTheme();
    wireThemeToggle();
    wirePasswordToggles();
    wireLogin();
    wireForgotPassword();
    wireResetPassword();

    const isAdminPage = window.location.pathname.startsWith('/admin/');
    const authPages = ['login.html', 'register.html', 'forgot-password.html', 'reset-password.html'];
    const currentPage = window.location.pathname.split('/').pop();
    if (isAdminPage && !document.getElementById('login-form') && !authPages.includes(currentPage)) {
        initAdmin();
    }
});
