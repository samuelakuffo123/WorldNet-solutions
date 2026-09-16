/* Client dashboard: request cards, profile, password change. Requires app.js globals (api, escapeHtml, showToast, wnClient, CLIENT_STATUS_LABELS). */

const CLIENT_BADGE_CLASSES = {
    pending: 'pending-badge',
    contacted: 'viewed-badge',
    confirmed: 'viewed-badge',
    completed: 'viewed-badge',
    closed: 'cancelled-badge',
    cancelled: 'cancelled-badge',
    withdrawn: 'cancelled-badge'
};

function clientBadgeClass(status) {
    return CLIENT_BADGE_CLASSES[status] || 'pending-badge';
}

function statusHistoryToTimeline(history) {
    if (!history || !history.length) return '';
    return history.map((entry) => `
        <li>
            <strong>${escapeHtml((CLIENT_STATUS_LABELS[entry.status] || entry.status))}</strong>
            <span class="muted">— ${entry.at ? new Date(entry.at).toLocaleString() : ''}${entry.by ? ` · ${escapeHtml(entry.by)}` : ''}</span>
        </li>`).join('');
}

async function renderClientDashboard() {
    const gate = document.getElementById('client-gate');
    const dash = document.getElementById('client-dashboard');
    if (!dash) return;
    if (typeof whenClientSessionReady === 'function') await whenClientSessionReady();
    if (!wnClient) {
        if (gate) gate.hidden = false;
        dash.hidden = true;
        return;
    }
    if (gate) gate.hidden = true;
    dash.hidden = false;

    let consultations = [];
    try {
        const data = await api('/api/auth/consultations');
        consultations = data.consultations || [];
    } catch (_error) {
        consultations = [];
    }

    dash.innerHTML = `
        <h1>Your requests</h1>
        <p class="muted">Requests from your account. Click a card to see the full message and any notes from our team.</p>

        <div class="client-toolbar">
            <button type="button" class="btn btn-primary" onclick="window.location.href='/consultation.html'">＋ New consultation request</button>
        </div>

        ${consultations.length === 0 ? `
            <div class="card empty-card">
                <p>You have no consultation requests yet.</p>
                <a class="btn btn-primary" href="/consultation.html">Request your first consultation</a>
            </div>` : `
            <div class="client-card-list">
                ${consultations.map((item) => `
                    <article class="card client-card">
                        <details>
                            <summary>
                                <div class="client-card-head">
                                    <div>
                                        <h3 style="margin:0 0 0.2rem">${escapeHtml(item.serviceType || 'Consultation request')}</h3>
                                        <p class="muted" style="margin:0; font-size:0.85rem">Submitted ${item.createdAt ? new Date(item.createdAt).toLocaleString() : 'recently'}${item.preferredTimeframe ? ` · ${escapeHtml((CLIENT_TIMEFRAME_LABELS && CLIENT_TIMEFRAME_LABELS[item.preferredTimeframe]) || item.preferredTimeframe)}` : ''}</p>
                                    </div>
                                    <span class="pill ${clientBadgeClass(item.status)}">${escapeHtml((CLIENT_STATUS_LABELS[item.status] || item.status))}</span>
                                </div>
                                <span class="client-card-hint">${item.adminNotes ? 'Updated by our team' : 'Tap for details'}</span>
                            </summary>
                            <div class="client-card-body">
                                ${item.notes ? `<p><strong>What you told us:</strong></p><p class="muted">${escapeHtml(item.notes)}</p>` : ''}
                                <p class="muted">We will reply via ${item.preferredContact === 'phone' ? 'phone' : 'email'}${item.preferredDate ? ` · Preferred: ${escapeHtml(item.preferredDate)}${item.preferredTime ? ` at ${escapeHtml(item.preferredTime)}` : ''}` : ''}</p>
                                ${item.adminNotes ? `<div class="admin-note"><strong>Team note:</strong> ${escapeHtml(item.adminNotes)}</div>` : ''}
                                ${(item.statusHistory && item.statusHistory.length) ? `
                                    <p><strong>Timeline</strong></p>
                                    <ul class="timeline">${statusHistoryToTimeline(item.statusHistory)}</ul>` : ''}
                            </div>
                        </details>
                    </article>`).join('')}
            </div>`}

        <section class="card" style="padding:1.5rem; margin-top:1.5rem">
            <h2>Your profile</h2>
            <form id="client-profile-form" class="form-grid" novalidate>
                <div><label for="profile-name">Full name</label><input id="profile-name" name="fullName" value="${escapeHtml(wnClient.fullName || '')}" required /></div>
                <div><label for="profile-company">Company (optional)</label><input id="profile-company" name="companyName" value="${escapeHtml(wnClient.companyName || '')}" /></div>
                <div><label for="profile-phone">Phone</label><input id="profile-phone" name="phone" value="${escapeHtml(wnClient.phone || '')}" required /></div>
                <div><label for="profile-email">Email (login)</label><input id="profile-email" value="${escapeHtml(wnClient.email || '')}" disabled title="Your email is your login and cannot be changed." /></div>
                <button class="btn btn-primary" type="submit">Save changes</button>
                <p data-form-status class="muted" aria-live="polite"></p>
            </form>
        </section>

        <section class="card" style="padding:1.5rem">
            <h2>Connected accounts</h2>
            <div id="client-connected"></div>
        </section>

        <section class="card" style="padding:1.5rem">
            <h2>${wnClient.hasPassword ? 'Change password' : 'Set a password'}</h2>
            <form id="client-password-form" class="form-grid" novalidate>
                ${wnClient.hasPassword ? '<div><label for="pw-current">Current password</label><input id="pw-current" name="currentPassword" type="password" required autocomplete="current-password" /></div>' : ''}
                <div><label for="pw-new">${wnClient.hasPassword ? 'New password (8+ characters)' : 'Password (8+ characters)'}</label><input id="pw-new" name="newPassword" type="password" required minlength="8" autocomplete="new-password" /></div>
                <button class="btn btn-secondary" type="submit">${wnClient.hasPassword ? 'Update password' : 'Set password'}</button>
                <p data-form-status class="muted" aria-live="polite"></p>
            </form>
        </section>

        <div style="margin-top:1.5rem">
            <button type="button" class="btn btn-secondary" data-client-logout>Sign out</button>
        </div>`;

    const profileForm = document.getElementById('client-profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const status = profileForm.querySelector('[data-form-status]');
            setFormStatus(profileForm, 'Saving…', '');
            try {
                const body = Object.fromEntries(new FormData(profileForm).entries());
                delete body.email;
                const data = await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify(body) });
                wnClient = data.client;
                showToast('Profile updated.');
                setFormStatus(profileForm, 'Profile updated.', 'success');
            } catch (error) {
                setFormStatus(profileForm, error.message, 'error');
            }
        });
    }

    const passwordForm = document.getElementById('client-password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const status = passwordForm.querySelector('[data-form-status]');
            setFormStatus(passwordForm, 'Saving…', '');
            try {
                const body = Object.fromEntries(new FormData(passwordForm).entries());
                await api('/api/auth/password', { method: 'POST', body: JSON.stringify(body) });
                if (!body.currentPassword) {
                    wnClient.hasPassword = true;
                    showToast('Password set. You can now sign in with email and password too.');
                    renderClientDashboard();
                    return;
                }
                passwordForm.reset();
                showToast('Password updated.');
                setFormStatus(passwordForm, 'Password updated.', 'success');
            } catch (error) {
                setFormStatus(passwordForm, error.message, 'error');
            }
        });
    }

    renderConnectedAccounts(document.getElementById('client-connected'));

    const logoutButton = dash.querySelector('[data-client-logout]');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await api('/api/logout', { method: 'POST' });
            } catch (_error) { /* ignore */ }
            window.location.reload();
        });
    }
}

async function renderConnectedAccounts(container) {
    if (!container) return;
    const linked = Boolean(wnClient && wnClient.googleId);
    if (linked) {
        container.innerHTML = `
            <div class="connected-row">
                <div class="connected-info">
                    <strong>Google</strong>
                    <p class="muted" style="margin:0">${escapeHtml(wnClient.email)} — verified by Google</p>
                </div>
                ${wnClient.hasPassword
                    ? '<button type="button" class="btn btn-secondary btn-sm" data-google-disconnect>Disconnect</button>'
                    : '<p class="muted" style="margin:0">Connected via Google. Set a password first to disconnect safely.</p>'}
            </div>`;
        const disconnect = container.querySelector('[data-google-disconnect]');
        if (disconnect) {
            disconnect.addEventListener('click', async () => {
                if (!window.confirm('Disconnect Google from this account? You can still sign in with your email and password.')) return;
                try {
                    const data = await api('/api/auth/google/disconnect', { method: 'POST' });
                    wnClient = data.client;
                    await refreshClientSession();
                    showToast('Google disconnected. You can sign in with your email and password.');
                    renderClientDashboard();
                } catch (error) {
                    showToast(error.message);
                }
            });
        }
        return;
    }

    container.innerHTML = `
        <div class="connected-row">
            <div class="connected-info">
                <strong>Google</strong>
                <p class="muted" style="margin:0">Not connected — link it to sign in with one click.</p>
            </div>
            <span id="google-connect-slot"></span>
        </div>`;
    const slot = container.querySelector('#google-connect-slot');
    await initGoogleClient();
    if (!wnGoogleClientId) {
        if (slot) slot.innerHTML = '<span class="muted">Google sign-in is not enabled on this server yet.</span>';
        return;
    }
    try {
        window.google.accounts.id.renderButton(slot, { type: 'standard', shape: 'pill', theme: 'outline', text: 'continue_with', size: 'large' });
    } catch (_error) {
        if (slot) slot.innerHTML = '<span class="muted">Google sign-in unavailable.</span>';
    }
}

document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-sign-up-any]');
    if (!trigger) return;
    event.preventDefault();
    openAuthModal('signup');
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderClientDashboard);
} else {
    renderClientDashboard();
}