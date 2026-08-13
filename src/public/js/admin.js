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
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
};

/* ---------------- Shared shell ---------------- */

const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', href: '/admin/dashboard.html', icon: 'dashboard' },
    { key: 'services', label: 'Services', href: '/admin/records.html?type=services', icon: 'services' },
    { key: 'inquiries', label: 'Inquiries', href: '/admin/records.html?type=inquiries', icon: 'inquiries' },
    { key: 'consultations', label: 'Consultations', href: '/admin/consultations.html', icon: 'consultations' },
    { key: 'portfolio', label: 'Portfolio', href: '/admin/records.html?type=portfolio', icon: 'portfolio' },
    { key: 'team', label: 'Team', href: '/admin/dashboard.html#team', icon: 'team' }
];

function getCurrentPageKey() {
    const pathname = window.location.pathname;
    if (pathname === '/admin/dashboard.html') return 'dashboard';
    if (pathname === '/admin/consultations.html') return 'consultations';
    if (pathname === '/admin/records.html') {
        return new URLSearchParams(window.location.search).get('type') || 'services';
    }
    return null;
}

function buildSidebar(activeKey) {
    const admin = getAdminProfile();
    const groups = {
        general: NAV_ITEMS.slice(0, 6)
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
            <div class="sidebar-user">
                <div class="avatar">${escapeHtml(getInitials(admin?.name))}</div>
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

        <div class="panel-grid" style="grid-template-columns: 1fr 1fr">
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
                await authApi('/api/admin/workers', { method: 'POST', body: JSON.stringify(payload) });
                event.target.reset();
                showToast('Team member added');
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

/* ---------------- Login ---------------- */

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
            localStorage.setItem('worldnet_token', data.token);
            localStorage.setItem('worldnet_admin', JSON.stringify(data.admin || {}));
            showToast(`Welcome, ${data.admin?.name?.split(' ')[0] || 'Admin'}!`);
            setTimeout(() => {
                window.location.href = '/admin/dashboard.html';
            }, 450);
        } catch (error) {
            if (button) { button.disabled = false; button.textContent = 'Sign in'; }
            showToast(error.message);
        }
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
    }

    if (window.location.hash === '#team') {
        const teamSection = document.getElementById('team-roster');
        if (teamSection) teamSection.scrollIntoView({ behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    wireLogin();

    const isAdminPage = window.location.pathname.startsWith('/admin/');
    if (isAdminPage && !document.getElementById('login-form')) {
        initAdmin();
    }
});
