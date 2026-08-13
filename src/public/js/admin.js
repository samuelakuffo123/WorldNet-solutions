function getToken() {
    return localStorage.getItem('worldnet_token');
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function formatRelativeTime(dateString) {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
}

function resetServiceForm() {
    const form = document.getElementById('service-form');
    if (!form) return;
    form.reset();
    document.getElementById('service-edit-id').value = '';
    document.getElementById('service-submit-btn').textContent = 'Save service';
    document.getElementById('cancel-service-edit').style.display = 'none';
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
    document.getElementById('service-submit-btn').textContent = 'Update service';
    document.getElementById('cancel-service-edit').style.display = 'inline-flex';
}

async function authApi(path, options = {}) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${getToken()}` },
        ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function getFilteredItems(items, searchSelector, statusSelector, valueFields = []) {
    const searchValue = document.getElementById(searchSelector).value.toLowerCase();
    const statusValue = document.getElementById(statusSelector).value;
    return items.filter((item) => {
        const matchesSearch = !searchValue || valueFields.map((field) => String(item[field] || '')).join(' ').toLowerCase().includes(searchValue);
        const matchesStatus = statusValue === 'all' || item.status === statusValue;
        return matchesSearch && matchesStatus;
    });
}

function downloadCsv(filename, rows) {
    if (!rows.length) {
        rows = [{ empty: 'No records' }];
    }
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

function getCurrentAdminPage() {
    const pathname = window.location.pathname;
    if (pathname === '/admin/consultations.html') return 'consultations';
    if (pathname === '/admin/records.html') {
        return new URLSearchParams(window.location.search).get('type') || 'services';
    }
    return null;
}

async function renderRecordsPage(type) {
    const shell = document.getElementById('records-content');
    const title = document.getElementById('records-heading');
    const subtitle = document.getElementById('records-subtitle');
    if (!shell) return;

    shell.innerHTML = '<div class="card" style="padding:1rem"><p class="muted">Loading detailed records…</p></div>';
    if (title) {
        const labels = {
            services: 'Services',
            inquiries: 'Inquiries',
            consultations: 'Consultations',
            portfolio: 'Portfolio'
        };
        title.textContent = labels[type] || 'Detailed records';
    }
    if (subtitle) {
        subtitle.textContent = `Full ${type} records with status updates and detailed information.`;
    }

    try {
        if (type === 'services') {
            const services = await authApi('/api/services');
            shell.innerHTML = services.length
                ? `<div class="grid-2">${services.map((service) => `
                    <article class="card" style="padding:1rem">
                      <div class="pill">${escapeHtml(service.category)}</div>
                      <h3 style="margin:0.8rem 0 0.3rem">${escapeHtml(service.name)}</h3>
                      <p class="muted" style="margin:0">${escapeHtml(service.summary)}</p>
                      <p style="margin:0.8rem 0">${escapeHtml(service.description || '')}</p>
                      <p><strong>Icon:</strong> ${escapeHtml(service.icon || '—')}</p>
                      <p><strong>Deliverables:</strong> ${escapeHtml(service.deliverables || '—')}</p>
                      <p><strong>Price:</strong> ${escapeHtml(service.priceRange || '—')}</p>
                      <ul class="list">${(service.features || []).map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>
                      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:1rem">
                        <a class="btn btn-secondary" href="/admin/dashboard.html">Edit in dashboard</a>
                        <button class="btn btn-secondary" data-delete-service="${service.id}">Delete</button>
                      </div>
                    </article>`).join('')}</div>`
                : '<div class="card" style="padding:1rem"><p class="muted">No services yet.</p></div>';
        } else if (type === 'inquiries') {
            const inquiries = await authApi('/api/inquiries');
            shell.innerHTML = inquiries.length
                ? `<div class="grid-2">${inquiries.map((item) => `
                    <article class="card" style="padding:1rem">
                      <h3 style="margin:0 0 0.35rem">${escapeHtml(item.name)}</h3>
                      <p class="muted" style="margin:0">${escapeHtml(item.email)} • ${escapeHtml(item.phone)}</p>
                      <p style="margin:0.5rem 0"><strong>Service:</strong> ${escapeHtml(item.service_type || '—')}</p>
                      <p style="margin:0.5rem 0"><strong>Message:</strong> ${escapeHtml(item.message || '—')}</p>
                      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; margin-top:0.8rem">
                        <select data-status-select="inquiry-${item.id}">
                          <option value="new" ${item.status === 'new' ? 'selected' : ''}>New</option>
                          <option value="contacted" ${item.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                          <option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                        <button class="btn btn-secondary" data-update-inquiry="${item.id}">Save</button>
                      </div>
                    </article>`).join('')}</div>`
                : '<div class="card" style="padding:1rem"><p class="muted">No inquiries yet.</p></div>';
        } else if (type === 'consultations') {
            const consultations = await authApi('/api/consultations');
            const workers = await authApi('/api/admin/workers');
            const departmentOptions = [...new Set(workers.map((worker) => worker.department))].sort();
            shell.innerHTML = `
              <div class="card" style="padding:1rem; margin-bottom:1rem">
                <h3 style="margin:0 0 0.3rem">Team roster</h3>
                <p class="muted" style="margin:0">Assign requests to a department and a designated worker for follow-up.</p>
                <div class="grid-2" style="margin-top:0.8rem">
                  ${workers.map((worker) => `
                    <div class="card" style="padding:0.8rem; background:rgba(37, 99, 235, 0.05)">
                      <strong>${escapeHtml(worker.name)}</strong>
                      <p class="muted" style="margin:0.25rem 0 0">${escapeHtml(worker.department)} • ${escapeHtml(worker.role)}</p>
                    </div>`).join('')}
                </div>
              </div>
              ${consultations.length
                    ? `<div class="grid-2">${consultations.map((item) => `
                    <article class="card" style="padding:1rem">
                      <h3 style="margin:0 0 0.35rem">${escapeHtml(item.name)}</h3>
                      <p class="muted" style="margin:0">${escapeHtml(item.email)} • ${escapeHtml(item.phone)}</p>
                      <p style="margin:0.5rem 0"><strong>Preferred date:</strong> ${escapeHtml(item.preferred_date || '—')}</p>
                      <p style="margin:0.5rem 0"><strong>Preferred time:</strong> ${escapeHtml(item.preferred_time || '—')}</p>
                      <p style="margin:0.5rem 0"><strong>Company:</strong> ${escapeHtml(item.company || '—')}</p>
                      <p style="margin:0.5rem 0"><strong>Notes:</strong> ${escapeHtml(item.notes || '—')}</p>
                      <p style="margin:0.5rem 0"><strong>Assigned department:</strong> ${escapeHtml(item.assignedDepartment || 'Not assigned')}</p>
                      <p style="margin:0.5rem 0"><strong>Assigned worker:</strong> ${escapeHtml(item.assignedWorker || 'Not assigned')}</p>
                      <p style="margin:0.5rem 0"><strong>Handled by:</strong> ${escapeHtml(item.handledBy || 'Not handled yet')}</p>
                      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; margin-top:0.8rem">
                        <select data-status-select="consultation-${item.id}">
                          <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
                          <option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                          <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option>
                          <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <select data-department-select="consultation-${item.id}">
                          <option value="">No department</option>
                          ${departmentOptions.map((department) => `<option value="${escapeHtml(department)}" ${item.assignedDepartment === department ? 'selected' : ''}>${escapeHtml(department)}</option>`).join('')}
                        </select>
                        <select data-worker-select="consultation-${item.id}">
                          <option value="">No worker</option>
                          ${workers.map((worker) => `<option value="${escapeHtml(worker.name)}" ${item.assignedWorker === worker.name ? 'selected' : ''}>${escapeHtml(worker.name)} (${escapeHtml(worker.department)})</option>`).join('')}
                        </select>
                        <button class="btn btn-secondary" data-update-consultation="${item.id}">Save</button>
                      </div>
                    </article>`).join('')}</div>`
                    : '<div class="card" style="padding:1rem"><p class="muted">No consultations yet.</p></div>'}
            `;
        } else if (type === 'portfolio') {
            const portfolio = await authApi('/api/portfolio');
            shell.innerHTML = portfolio.length
                ? `<div class="grid-2">${portfolio.map((item) => `
                    <article class="card" style="padding:1rem">
                      <div class="pill">${escapeHtml(item.category)}</div>
                      <h3 style="margin:0.8rem 0 0.3rem">${escapeHtml(item.title)}</h3>
                      <p class="muted" style="margin:0">Client: ${escapeHtml(item.client)}</p>
                      <p style="margin:0.8rem 0">${escapeHtml(item.description || '')}</p>
                      <p><strong>Outcome:</strong> ${escapeHtml(item.outcome || '—')}</p>
                      <button class="btn btn-secondary" data-delete-portfolio="${item.id}" style="margin-top:0.8rem">Delete</button>
                    </article>`).join('')}</div>`
                : '<div class="card" style="padding:1rem"><p class="muted">No portfolio items yet.</p></div>';
        }

        document.querySelectorAll('[data-delete-service]').forEach((button) => {
            button.addEventListener('click', async () => {
                await authApi(`/api/services/${button.getAttribute('data-delete-service')}`, { method: 'DELETE' });
                showToast('Service deleted');
                renderRecordsPage(type);
            });
        });
        document.querySelectorAll('[data-delete-portfolio]').forEach((button) => {
            button.addEventListener('click', async () => {
                await authApi(`/api/portfolio/${button.getAttribute('data-delete-portfolio')}`, { method: 'DELETE' });
                showToast('Portfolio item deleted');
                renderRecordsPage(type);
            });
        });
        document.querySelectorAll('[data-update-inquiry]').forEach((button) => {
            button.addEventListener('click', async () => {
                const inquiryId = button.getAttribute('data-update-inquiry');
                const select = document.querySelector(`[data-status-select="inquiry-${inquiryId}"]`);
                if (!select) return;
                await authApi(`/api/inquiries/${inquiryId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: select.value })
                });
                showToast('Inquiry status updated');
                renderRecordsPage(type);
            });
        });
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
    } catch (error) {
        shell.innerHTML = `<div class="card" style="padding:1rem"><p class="muted">${escapeHtml(error.message)}</p></div>`;
    }
}

async function loadDashboard() {
    try {
        const stats = await authApi('/api/admin/stats');
        document.getElementById('stats-services').textContent = stats.services;
        document.getElementById('stats-inquiries').textContent = stats.inquiries;
        document.getElementById('stats-consultations').textContent = stats.consultations;
        document.getElementById('stats-portfolio').textContent = stats.portfolio;
        document.getElementById('stats-workers').textContent = stats.workers;
        document.getElementById('stats-notifications').textContent = stats.notifications || 0;
        const services = await authApi('/api/services');
        const inquiries = await authApi('/api/inquiries');
        const consultations = await authApi('/api/consultations');
        const portfolio = await authApi('/api/portfolio');
        document.getElementById('services-body').innerHTML = services.length
            ? services.map((service) => `
      <tr>
        <td>${escapeHtml(service.name)}</td>
        <td>${escapeHtml(service.category)}</td>
        <td>${escapeHtml(service.summary)}</td>
        <td>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
            <button class="btn btn-secondary" data-edit-service="${service.id}">Edit</button>
            <button class="btn btn-secondary" data-delete-service="${service.id}">Delete</button>
          </div>
        </td>
      </tr>`).join('')
            : '<tr><td colspan="4" class="muted">No services yet.</td></tr>';
        const filteredInquiries = getFilteredItems(inquiries, 'inquiries-search', 'inquiries-status-filter', ['name', 'email', 'service_type', 'status']);
        document.getElementById('inquiries-body').innerHTML = filteredInquiries.length
            ? filteredInquiries.slice(0, 8).map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.email)}</td>
        <td>${escapeHtml(item.service_type)}</td>
        <td>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
            <select data-status-select="inquiry-${item.id}">
              <option value="new" ${item.status === 'new' ? 'selected' : ''}>New</option>
              <option value="contacted" ${item.status === 'contacted' ? 'selected' : ''}>Contacted</option>
              <option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            </select>
            <button class="btn btn-secondary" data-update-inquiry="${item.id}">Save</button>
          </div>
        </td>
      </tr>`).join('')
            : '<tr><td colspan="4" class="muted">No matching inquiries.</td></tr>';
        const filteredConsultations = getFilteredItems(consultations, 'consultations-search', 'consultations-status-filter', ['name', 'email', 'preferred_date', 'preferred_time', 'status']);
        document.getElementById('consultations-body').innerHTML = filteredConsultations.length
            ? filteredConsultations.slice(0, 8).map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.preferred_date)}</td>
        <td>${escapeHtml(item.preferred_time)}</td>
        <td>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
            <select data-status-select="consultation-${item.id}">
              <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option>
              <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
            <button class="btn btn-secondary" data-update-consultation="${item.id}">Save</button>
          </div>
        </td>
      </tr>`).join('')
            : '<tr><td colspan="4" class="muted">No matching consultations.</td></tr>';
        document.getElementById('portfolio-body').innerHTML = portfolio.length
            ? portfolio.map((item) => `
      <tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.client)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td><button class="btn btn-secondary" data-delete-portfolio="${item.id}">Delete</button></td>
      </tr>`).join('')
            : '<tr><td colspan="4" class="muted">No portfolio items yet.</td></tr>';
        const workers = await authApi('/api/admin/workers');
        const notifications = await authApi('/api/admin/notifications');
        const notificationList = document.getElementById('notifications-list');
        if (notificationList) {
            notificationList.innerHTML = notifications.length
                ? notifications.slice(0, 6).map((notification) => `
                  <div class="card" style="padding:0.8rem; background:${notification.read ? 'rgba(148, 163, 184, 0.12)' : 'rgba(37, 99, 235, 0.08)'}">
                    <strong>${escapeHtml(notification.title)}</strong>
                    <p class="muted" style="margin:0.25rem 0">${escapeHtml(notification.message)}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-top:0.4rem">
                      <span class="pill">${escapeHtml(notification.type)}</span>
                      <span class="muted">${escapeHtml(formatRelativeTime(notification.createdAt))}</span>
                    </div>
                    ${notification.read ? '' : `<button class="btn btn-secondary" style="margin-top:0.5rem" data-mark-notification="${notification.id}">Mark read</button>`}
                  </div>`).join('')
                : '<p class="muted">No new alerts yet.</p>';
        }
        document.querySelectorAll('[data-mark-notification]').forEach((button) => {
            button.addEventListener('click', async () => {
                await authApi(`/api/admin/notifications/${button.getAttribute('data-mark-notification')}/read`, { method: 'PUT' });
                showToast('Notification marked as read');
                loadDashboard();
            });
        });
        const teamRoster = document.getElementById('team-roster');
        if (teamRoster) {
            teamRoster.innerHTML = workers.length
                ? workers.map((worker) => `
                  <div class="card" style="padding:0.8rem; background:rgba(37, 99, 235, 0.05)">
                    <strong>${escapeHtml(worker.name)}</strong>
                    <button class="btn btn-secondary" type="button" style="margin-top:0.6rem" data-delete-worker="${worker.id}">Remove worker</button>
                    <p class="muted" style="margin:0.25rem 0 0">${escapeHtml(worker.department)} • ${escapeHtml(worker.role)}</p>
                  </div>`).join('')
                : '<p class="muted">No workers available.</p>';
        }
        document.querySelectorAll('[data-delete-worker]').forEach((button) => {
            button.addEventListener('click', async () => {
                await authApi(`/api/admin/workers/${button.getAttribute('data-delete-worker')}`, { method: 'DELETE' });
                showToast('Worker removed and any assigned consultations were unassigned.');
                loadDashboard();
            });
        });
        document.querySelectorAll('[data-edit-service]').forEach((button) => {
            button.addEventListener('click', async () => {
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
                loadDashboard();
            });
        });
    } catch (error) {
        showToast(error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const payload = Object.fromEntries(new FormData(loginForm).entries());
            const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showToast(data.error || 'Login failed');
                return;
            }
            localStorage.setItem('worldnet_token', data.token);
            window.location.href = '/admin/dashboard.html';
        });
    }

    if (document.getElementById('dashboard-shell')) {
        if (!getToken()) {
            window.location.href = '/admin/login.html';
            return;
        }
        loadDashboard();
        document.getElementById('logout-btn').addEventListener('click', async () => {
            localStorage.removeItem('worldnet_token');
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/admin/login.html';
        });
        document.getElementById('service-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const payload = Object.fromEntries(new FormData(event.target).entries());
            const serviceId = payload.id;
            if (serviceId) {
                await authApi(`/api/services/${serviceId}`, { method: 'PUT', body: JSON.stringify(payload) });
                showToast('Service updated');
            } else {
                await authApi('/api/services', { method: 'POST', body: JSON.stringify(payload) });
                showToast('Service created');
            }
            resetServiceForm();
            loadDashboard();
        });
        document.getElementById('cancel-service-edit').addEventListener('click', () => {
            resetServiceForm();
        });
        document.getElementById('worker-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const payload = Object.fromEntries(new FormData(event.target).entries());
            await authApi('/api/admin/workers', { method: 'POST', body: JSON.stringify(payload) });
            event.target.reset();
            showToast('Worker added');
            loadDashboard();
        });
        document.getElementById('inquiries-search').addEventListener('input', loadDashboard);
        document.getElementById('inquiries-status-filter').addEventListener('change', loadDashboard);
        document.getElementById('consultations-search').addEventListener('input', loadDashboard);
        document.getElementById('consultations-status-filter').addEventListener('change', loadDashboard);
        document.getElementById('export-inquiries-btn').addEventListener('click', async () => {
            const inquiries = await authApi('/api/inquiries');
            const filteredInquiries = getFilteredItems(inquiries, 'inquiries-search', 'inquiries-status-filter', ['name', 'email', 'service_type', 'status']);
            downloadCsv('inquiries.csv', filteredInquiries.map((item) => ({
                name: item.name,
                email: item.email,
                service_type: item.service_type,
                status: item.status,
                createdAt: item.createdAt
            })));
        });
        document.getElementById('export-consultations-btn').addEventListener('click', async () => {
            const consultations = await authApi('/api/consultations');
            const filteredConsultations = getFilteredItems(consultations, 'consultations-search', 'consultations-status-filter', ['name', 'email', 'preferred_date', 'preferred_time', 'status']);
            downloadCsv('consultations.csv', filteredConsultations.map((item) => ({
                name: item.name,
                email: item.email,
                preferred_date: item.preferred_date,
                preferred_time: item.preferred_time,
                status: item.status,
                createdAt: item.createdAt
            })));
        });
        document.getElementById('portfolio-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const payload = Object.fromEntries(new FormData(event.target).entries());
            await authApi('/api/portfolio', { method: 'POST', body: JSON.stringify(payload) });
            event.target.reset();
            showToast('Portfolio item added');
            loadDashboard();
        });
    }

    const currentAdminPage = getCurrentAdminPage();
    if (currentAdminPage && document.getElementById('records-content')) {
        if (!getToken()) {
            window.location.href = '/admin/login.html';
            return;
        }
        const logoutButton = document.getElementById('logout-btn');
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                localStorage.removeItem('worldnet_token');
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/admin/login.html';
            });
        }
        renderRecordsPage(currentAdminPage);
    }
});
