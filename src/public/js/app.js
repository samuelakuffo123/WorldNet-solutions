const pages = {
    '/': 'Home',
    '/services.html': 'Services',
    '/service-details.html': 'Services',
    '/about.html': 'About',
    '/portfolio.html': 'Portfolio',
    '/team.html': 'Our team',
    '/contact.html': 'Contact',
    '/consultation.html': 'Consultation',
    '/client.html': 'My requests'
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setActiveNav() {
    const current = window.location.pathname;
    document.querySelectorAll('[data-nav-link]').forEach((link) => {
        const href = link.getAttribute('href');
        link.classList.toggle('active', href === current || (current === '/' && href === '/index.html'));
    });
    document.querySelectorAll('[data-nav-dropdown]').forEach((dropdown) => {
        const trigger = dropdown.querySelector('.nav-dropdown-trigger');
        if (!trigger) return;
        const active = Array.from(dropdown.querySelectorAll('[data-nav-link]')).some((link) => {
            const href = link.getAttribute('href');
            return href === current;
        });
        trigger.classList.toggle('active', active);
    });
}

function closeAllNavDropdowns() {
    document.querySelectorAll('[data-nav-dropdown]').forEach((dropdown) => {
        dropdown.setAttribute('data-open', 'false');
        const trigger = dropdown.querySelector('.nav-dropdown-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
}

function setupNavDropdowns() {
    document.querySelectorAll('[data-nav-dropdown]').forEach((dropdown) => {
        const trigger = dropdown.querySelector('.nav-dropdown-trigger');
        if (!trigger) return;
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const open = dropdown.getAttribute('data-open') !== 'true';
            closeAllNavDropdowns();
            dropdown.setAttribute('data-open', String(open));
            trigger.setAttribute('aria-expanded', String(open));
        });
        dropdown.addEventListener('click', (event) => event.stopPropagation());
    });
    document.addEventListener('click', closeAllNavDropdowns);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeAllNavDropdowns();
    });
}

function setupMobileNav() {
    const toggle = document.getElementById('nav-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        document.body.classList.toggle('menu-open', !open);
    });
    document.querySelectorAll('.nav-links a').forEach((link) => {
        link.addEventListener('click', () => {
            toggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('menu-open');
            closeAllNavDropdowns();
        });
    });
}

function setupHeaderScrollState() {
    const header = document.querySelector('header');
    if (!header) return;
    const hero = document.querySelector('.hero, .hero-secondary');
    const threshold = Math.max(hero ? hero.getBoundingClientRect().height * 0.35 : 0, 12);
    const update = () => header.classList.toggle('scrolled', window.scrollY > threshold);
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
}

function setupHeroParallax() {
    const images = document.querySelectorAll('.hero-visual img, .hero-image img');
    if (!images.length || shouldPreferReducedMotion()) return;
    let ticking = false;
    const update = () => {
        const viewportCenter = window.innerHeight / 2;
        images.forEach((img) => {
            const frame = img.closest('.hero-visual, .hero-image');
            if (!frame) return;
            const bounds = frame.getBoundingClientRect();
            if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
            const frameCenter = bounds.top + bounds.height / 2;
            const travel = frameCenter - viewportCenter;
            const shift = Math.max(-30, Math.min(30, travel * -0.12));
            img.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0) scale(1.15)`;
        });
        ticking = false;
    };
    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }, { passive: true });
    if (window.ResizeObserver) {
        new ResizeObserver(() => requestAnimationFrame(update)).observe(document.body);
    }
    update();
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    if (!toast.hasAttribute('role')) toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function setFormStatus(form, message, type = 'success') {
    let status = form.querySelector('[data-form-status]');
    if (!status) {
        status = document.createElement('div');
        status.dataset.formStatus = 'true';
        form.insertBefore(status, form.querySelector('button[type="submit"]') || null);
    }
    status.className = `form-status ${type}`;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = message;
}

function prefillInquiryForm() {
    const form = document.getElementById('inquiry-form');
    if (!form) return;
    const params = new URLSearchParams(window.location.search);
    const requestedService = params.get('service');
    if (!requestedService) return;
    const select = form.querySelector('select[name="service_type"]');
    if (!select) return;
    const existing = Array.from(select.options).some((option) => option.value === requestedService);
    if (!existing) {
        select.add(new Option(requestedService, requestedService));
    }
    select.value = requestedService;
    const hint = form.querySelector('[data-service-hint]');
    if (hint) {
        hint.textContent = `Service request prepared for ${requestedService}`;
    }
}

const FIELD_LABELS = {
    name: 'name',
    email: 'email',
    phone: 'phone',
    service_type: 'service type',
    message: 'message',
    preferred_date: 'date',
    preferred_time: 'time'
};

function clearFieldErrors(form) {
    form.querySelectorAll('[data-field-error]').forEach((el) => el.remove());
    form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
}

function markFieldError(element, field, message) {
    element.setAttribute('aria-invalid', 'true');
    const errorId = `${element.id || field}-error`;
    let error = document.getElementById(errorId);
    if (!error) {
        error = document.createElement('span');
        error.id = errorId;
        error.setAttribute('data-field-error', 'true');
        element.insertAdjacentElement('afterend', error);
    }
    error.textContent = message;
    element.setAttribute('aria-describedby', errorId);
}

function fieldErrors(form, requiredFields) {
    const errors = [];
    for (const field of requiredFields) {
        const element = form.querySelector(`[name="${field}"]`);
        if (!element) continue;
        const value = String(element.value || '').trim();
        const label = FIELD_LABELS[field] || field;
        if (!value) {
            errors.push({ element, message: `Please enter your ${label}.` });
            continue;
        }
        if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push({ element, message: 'Please enter a valid email address.' });
        }
        if (field === 'phone' && !/^\+?[0-9()\-\s.]{7,20}$/.test(value)) {
            errors.push({ element, message: 'Please enter a valid phone number.' });
        }
    }
    return errors;
}

function getCsrfToken() {
    const match = document.cookie.split(';').map((s) => s.trim()).find((cookie) => cookie.startsWith('wn_csrf='));
    return match ? decodeURIComponent(match.slice('wn_csrf='.length)) : '';
}

async function api(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = { ...(options.headers || {}), 'Content-Type': 'application/json' };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        const csrf = getCsrfToken();
        if (csrf) headers['X-CSRF-Token'] = csrf;
    }
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function renderServices(cardsContainer, services) {
    if (!cardsContainer) return;
    cardsContainer.innerHTML = services.length
        ? services.map((service) => `
      <article class="card feature-card">
        <div class="pill">${escapeHtml(service.category)}</div>
        <h3 style="margin:0.8rem 0 0.35rem">${escapeHtml(service.name)}</h3>
        <p class="muted">${escapeHtml(service.summary)}</p>
        <a class="btn btn-secondary" href="/services/${encodeURIComponent(service.slug)}" style="margin-top:0.8rem">View details</a>
      </article>`).join('')
        : '<p class="muted">No services available right now.</p>';
}

async function loadHomeServices() {
    const container = document.getElementById('featured-services');
    if (!container) return;
    try {
        const services = await api('/api/services?limit=3');
        renderServices(container, services);
    } catch (error) {
        container.innerHTML = '<p class="muted">Unable to load services right now.</p>';
    }
}

async function loadServicesPage() {
    const container = document.getElementById('services-list');
    const filters = document.getElementById('service-filters');
    if (!container) return;
    try {
        const services = await api('/api/services');
        const categories = [...new Set(services.map((service) => service.category))];
        if (filters) {
            filters.innerHTML = ['All', ...categories].map((category, index) => `<button class="btn btn-secondary${index === 0 ? ' active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
            filters.querySelectorAll('button').forEach((button) => {
                button.addEventListener('click', () => {
                    filters.querySelectorAll('button').forEach((btn) => btn.classList.remove('active'));
                    button.classList.add('active');
                    const selected = button.getAttribute('data-category');
                    const visible = selected === 'All' ? services : services.filter((service) => service.category === selected);
                    renderServices(container, visible);
                });
            });
        }
        renderServices(container, services);
    } catch (error) {
        container.innerHTML = '<p class="muted">Unable to load services right now.</p>';
    }
}

async function loadServiceDetails() {
    const container = document.getElementById('service-details');
    if (!container) return;
    const params = new URLSearchParams(window.location.search);
    const pathSlug = window.location.pathname.split('/').filter(Boolean).pop();
    const idParam = params.get('id');
    const identifier = pathSlug && pathSlug !== 'service-details.html' ? pathSlug : idParam;
    if (!identifier) {
        window.location.href = '/404.html';
        return;
    }
    try {
        const service = await api(`/api/services/${identifier}`);
        if (pathSlug === 'service-details.html' && service.slug) {
            window.location.replace(`/services/${service.slug}`);
            return;
        }
        container.innerHTML = `
      <div class="card feature-card">
        <div class="pill">${escapeHtml(service.category)}</div>
        <h2 style="margin:1rem 0 0.4rem">${escapeHtml(service.name)}</h2>
        <p class="muted">${escapeHtml(service.description)}</p>
        <h3 style="margin:1.2rem 0 0.5rem">Highlights</h3>
        <ul class="list">${(service.features || []).map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>
        <h3 style="margin:1.2rem 0 0.5rem">Deliverables</h3>
        <p>${escapeHtml(service.deliverables)}</p>
        <div style="display:flex; gap:0.7rem; flex-wrap:wrap; margin-top:1rem">
          <a class="btn btn-primary" href="/contact.html?service=${encodeURIComponent(service.name)}">Request service</a>
          <a class="btn btn-secondary" href="/consultation.html?service=${encodeURIComponent(service.slug)}">Book a consultation</a>
        </div>
      </div>`;
        const heroConsultLink = document.querySelector('.hero-actions a[href="/consultation.html"]');
        if (heroConsultLink) {
            heroConsultLink.setAttribute('href', `/consultation.html?service=${encodeURIComponent(service.slug)}`);
        }
    } catch (error) {
        window.location.href = '/404.html';
    }
}

async function loadPortfolio() {
    const container = document.getElementById('portfolio-grid');
    if (!container) return;
    try {
        const items = await api('/api/portfolio');
        container.innerHTML = items.map((item) => `
      <article class="card feature-card">
        <div class="pill">${escapeHtml(item.category)}</div>
        <h3 style="margin:0.8rem 0 0.35rem">${escapeHtml(item.title)}</h3>
        <p class="muted">${escapeHtml(item.description)}</p>
        <p style="font-weight:700; margin-top:0.8rem">Outcome: ${escapeHtml(item.outcome)}</p>
        <a class="btn btn-secondary" href="/portfolio-details.html?id=${item.id}" style="margin-top:0.8rem">View case study</a>
      </article>`).join('');
    } catch (error) {
        container.innerHTML = '<p class="muted">Unable to load portfolio items right now.</p>';
    }
}

async function loadPortfolioDetails() {
    const container = document.getElementById('portfolio-details');
    if (!container) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
        container.innerHTML = '<p class="muted">No portfolio case study selected.</p>';
        return;
    }
    try {
        const items = await api('/api/portfolio');
        const item = items.find((entry) => entry.id === id);
        if (!item) {
            window.location.href = '/404.html';
            return;
        }
        container.innerHTML = `
      <div class="card feature-card">
        <div class="pill">${escapeHtml(item.category)}</div>
        <h2 style="margin:1rem 0 0.4rem">${escapeHtml(item.title)}</h2>
        <p class="muted">${escapeHtml(item.description)}</p>
        <div class="grid-2" style="margin-top:1rem">
          <div class="card" style="padding:1rem">
            <h3 style="margin-top:0">Client</h3>
            <p>${escapeHtml(item.client)}</p>
          </div>
          <div class="card" style="padding:1rem">
            <h3 style="margin-top:0">Outcome</h3>
            <p>${escapeHtml(item.outcome)}</p>
          </div>
        </div>
        <a class="btn btn-primary" href="/contact.html?service=${encodeURIComponent(item.title)}" style="margin-top:1rem">Discuss a similar project</a>
      </div>`;
    } catch (error) {
        container.innerHTML = '<p class="muted">Unable to load this case study right now.</p>';
    }
}

function autosaveForm(form, key) {
    if (!form) return;
    const syncInputs = () => {
        const data = {};
        for (const field of form.querySelectorAll('input[name], textarea[name], select[name]')) {
            if (field.type === 'file') continue;
            if (field.type === 'checkbox' || field.type === 'radio') {
                if (field.checked) data[field.name] = field.value;
                continue;
            }
            data[field.name] = field.value;
        }
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (_error) { /* unavailable storage */ }
    };
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const data = JSON.parse(raw);
            for (const field of form.querySelectorAll('input[name], textarea[name], select[name]')) {
                if (data[field.name] !== undefined) field.value = data[field.name];
            }
        }
    } catch (_error) { /* unreadable draft */ }
    form.addEventListener('input', syncInputs);
    form.addEventListener('change', syncInputs);
}

function clearAutosave(key) {
    try { localStorage.removeItem(key); } catch (_error) { /* unavailable storage */ }
}

async function submitForm(formId, endpoint) {
    const form = document.getElementById(formId);
    if (!form) return;
    autosaveForm(form, `wn-draft:${formId}`);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearFieldErrors(form);
        const requiredFields = formId === 'consultation-form'
            ? ['name', 'email', 'phone', 'preferred_date', 'preferred_time']
            : ['name', 'email', 'phone', 'service_type', 'message'];
        const missingFields = fieldErrors(form, requiredFields);
        if (missingFields.length) {
            for (const { element, message } of missingFields) {
                markFieldError(element, element.name, message);
            }
            const firstInvalid = missingFields[0].element;
            if (firstInvalid.focus) firstInvalid.focus();
            setFormStatus(form, missingFields.length === 1 ? 'Please fix the highlighted field.' : 'Please fix the highlighted fields.', 'error');
            return;
        }
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton ? submitButton.textContent : '';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting…';
        }
        try {
            const formData = Object.fromEntries(new FormData(form).entries());
            await api(endpoint, { method: 'POST', body: JSON.stringify(formData) });
            form.reset();
            clearAutosave(`wn-draft:${formId}`);
            clearFieldErrors(form);
            if (formId === 'inquiry-form') {
                prefillInquiryForm();
            }
            setFormStatus(form, 'Thanks! Your request was received and we will follow up shortly.', 'success');
            showToast('Thanks! Your request was received.');
            const status = form.querySelector('[data-form-status]');
            if (status && status.scrollIntoView) status.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (error) {
            setFormStatus(form, error.message || 'Submission failed. We could not save your request. Your details are still on this form, please try again.', 'error');
            showToast(error.message);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        }
    });
    form.addEventListener('input', (event) => {
        if (event.target && event.target.getAttribute('aria-invalid') === 'true') {
            const errorEl = event.target.getAttribute('aria-describedby') ? document.getElementById(event.target.getAttribute('aria-describedby')) : null;
            if (errorEl) errorEl.remove();
            event.target.removeAttribute('aria-invalid');
        }
    });
}

async function trackConsultationRequest() {
    const form = document.getElementById('consultation-tracker-form');
    const result = document.getElementById('consultation-tracker-result');
    if (!form || !result) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const email = String(formData.get('email') || '').trim();
        const phone = String(formData.get('phone') || '').trim();
        if (!email || !phone) {
            result.innerHTML = '<p class="muted" style="margin:0">Please enter both your email and phone number.</p>';
            return;
        }

        result.innerHTML = '<p class="muted" style="margin:0">Checking your request…</p>';
        try {
            const data = await api(`/api/consultations/track?email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`);
            const rawStatus = data.consultation.status || 'pending';
            const statusLabels = { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', withdrawn: 'Withdrawn' };
            const status = statusLabels[rawStatus] || 'Pending';
            const badgeClass = rawStatus === 'pending' ? 'pending-badge' : (rawStatus === 'confirmed' || rawStatus === 'completed') ? 'viewed-badge' : 'cancelled-badge';
            const createdAt = data.consultation.createdAt ? new Date(data.consultation.createdAt).toLocaleString() : 'Recently submitted';
            result.innerHTML = `
              <div style="display:flex; flex-direction:column; gap:0.5rem">
                <div><strong>${escapeHtml(data.consultation.name)}</strong></div>
                <div class="pill ${badgeClass}">${status}</div>
                <p style="margin:0">Requested for ${escapeHtml(data.consultation.preferred_date)} at ${escapeHtml(data.consultation.preferred_time)}</p>
                <p class="muted" style="margin:0">Submitted on ${createdAt}</p>
                ${data.consultation.handledBy ? `<p class="muted" style="margin:0">Handled by ${escapeHtml(data.consultation.handledBy)}</p>` : ''}
                <button class="btn btn-secondary" type="button" data-withdraw-request="${data.consultation.id}" style="align-self:flex-start">Withdraw request</button>
              </div>`;
            const withdrawButton = result.querySelector('[data-withdraw-request]');
            if (withdrawButton) {
                withdrawButton.addEventListener('click', async () => {
                    try {
                        await api(`/api/consultations/${data.consultation.id}/withdraw`, {
                            method: 'PUT',
                            body: JSON.stringify({ email, phone })
                        });
                        result.innerHTML = '<p class="muted" style="margin:0">Your request has been withdrawn.</p>';
                        showToast('Your request has been withdrawn.');
                    } catch (error) {
                        showToast(error.message);
                    }
                });
            }
        } catch (error) {
            result.innerHTML = `<p class="muted" style="margin:0">${escapeHtml(error.message)}</p>`;
        }
    });
}

function setMinConsultationDate() {
    const dateInput = document.querySelector('#consultation-form input[name="preferred_date"]');
    if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
}

/* ---------------- Client session & guest mode ---------------- */

let wnClient = null;
let authModalOpen = false;
let pendingConsultationSubmit = false;

const CLIENT_STATUS_LABELS = {
    pending: 'Pending Review',
    contacted: 'Contacted',
    confirmed: 'Scheduled',
    completed: 'Completed',
    closed: 'Closed',
    cancelled: 'Cancelled',
    withdrawn: 'Withdrawn'
};

const CLIENT_TIMEFRAME_LABELS = {
    asap: 'As soon as possible',
    within_a_week: 'Within a week',
    within_a_month: 'Within a month',
    just_exploring: 'Just exploring for now'
};

function currentClient() {
    return wnClient;
}

async function refreshClientSession() {
    try {
        const data = await api('/api/me');
        if (data.role === 'client' && data.client) {
            wnClient = data.client;
        } else {
            wnClient = null;
        }
    } catch (_error) {
        wnClient = null;
    }
    renderClientPill();
    return wnClient;
}

function renderClientPill() {
    const nav = document.querySelector('.nav-links');
    if (!nav) return;
    const existing = document.getElementById('wn-client-pill');
    if (existing) existing.remove();
    const pill = document.createElement('div');
    pill.id = 'wn-client-pill';
    pill.setAttribute('style', 'display:inline-flex; align-items:center');
    if (wnClient) {
        pill.innerHTML = `
            <button type="button" class="guest-pill" data-open-dashboard aria-label="Open your requests">
              <span class="guest-pill-dot" aria-hidden="true"></span> Hi, ${escapeHtml((wnClient.fullName || wnClient.email).split(' ')[0])} · Dashboard
            </button>`;
        pill.querySelector('[data-open-dashboard]').addEventListener('click', () => {
            window.location.href = '/client.html';
        });
    } else {
        pill.innerHTML = `
            <button type="button" class="guest-pill" data-sign-in-any>
              Browsing as Guest · <strong>Sign in</strong>
            </button>`;
        pill.querySelector('[data-sign-in-any]').addEventListener('click', (event) => {
            event.preventDefault();
            openAuthModal('login');
        });
    }
    nav.appendChild(pill);
}

function openAuthModal(defaultTab) {
    if (authModalOpen) return;
    authModalOpen = true;
    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'wn-auth-title');
    overlay.innerHTML = `
      <div class="auth-modal">
        <div class="auth-modal-head">
          <h2 id="wn-auth-title">Welcome</h2>
          <button type="button" class="auth-close" data-close-auth aria-label="Close">×</button>
        </div>
        <div class="auth-tabs" role="tablist">
          <button type="button" class="auth-tab" data-auth-tab="login" role="tab">Log in</button>
          <button type="button" class="auth-tab" data-auth-tab="signup" role="tab">Sign up</button>
        </div>
        <div data-google-item class="auth-google-block" hidden>
          <div data-google-signin></div>
          <div class="auth-or" aria-hidden="true"><span>or</span></div>
        </div>
        <form id="auth-login-form" class="auth-form" data-auth-panel="login" novalidate>
          <div><label for="auth-login-email">Email</label><input id="auth-login-email" name="email" type="email" required autocomplete="email" /></div>
          <div><label for="auth-login-password">Password</label><input id="auth-login-password" name="password" type="password" required autocomplete="current-password" /></div>
          <div class="auth-row">
            <button class="btn btn-primary" type="submit">Log in</button>
            <button type="button" class="linklike" data-open-forgot>Forgot password?</button>
          </div>
          <p data-form-status class="muted" style="min-height:1.2rem" aria-live="polite"></p>
        </form>
        <form id="auth-signup-form" class="auth-form" data-auth-panel="signup" novalidate hidden>
          <div><label for="auth-signup-name">Full name</label><input id="auth-signup-name" name="fullName" required autocomplete="name" /></div>
          <div><label for="auth-signup-email">Email (your login)</label><input id="auth-signup-email" name="email" type="email" required autocomplete="email" /></div>
          <div class="grid-2">
            <div><label for="auth-signup-phone">Phone</label><input id="auth-signup-phone" name="phone" required autocomplete="tel" /></div>
            <div><label for="auth-signup-company">Company (optional)</label><input id="auth-signup-company" name="companyName" autocomplete="organization" /></div>
          </div>
          <div><label for="auth-signup-password">Password (8+ characters)</label><input id="auth-signup-password" name="password" type="password" required minlength="8" autocomplete="new-password" /></div>
          <button class="btn btn-primary" type="submit">Create account</button>
          <p data-form-status class="muted" style="min-height:1.2rem" aria-live="polite"></p>
        </form>
        <div class="auth-forgot" data-auth-panel="forgot" hidden>
          <p class="muted">Enter your email and we will send you a reset link.</p>
          <form id="auth-forgot-form" class="form-grid" novalidate>
            <div><label for="auth-forgot-email">Email</label><input id="auth-forgot-email" name="email" type="email" required /></div>
            <button class="btn btn-secondary" type="submit">Send reset link</button>
            <p data-form-status class="muted" aria-live="polite"></p>
          </form>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');

    const switchPanel = (panel) => {
        overlay.querySelectorAll('[data-auth-panel]').forEach((el) => {
            const active = el.getAttribute('data-auth-panel') === panel;
            el.hidden = !active;
            if (el.tagName === 'FORM') {
                el.querySelectorAll('input').forEach((input) => { input.disabled = !active; });
            }
        });
        const googleBlock = overlay.querySelector('[data-google-item]');
        if (googleBlock && !googleBlock.hidden) googleBlock.hidden = (panel === 'forgot');
        overlay.querySelectorAll('[data-auth-tab]').forEach((tab) => {
            tab.classList.toggle('active', tab.getAttribute('data-auth-tab') === panel);
            tab.setAttribute('aria-selected', String(tab.getAttribute('data-auth-tab') === panel));
        });
    };

    overlay.querySelector('[data-close-auth]').addEventListener('click', closeAuthModal);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeAuthModal();
    });
    overlay.querySelectorAll('[data-auth-tab]').forEach((tab) => {
        tab.addEventListener('click', () => switchPanel(tab.getAttribute('data-auth-tab')));
    });
    overlay.querySelector('[data-open-forgot]').addEventListener('click', () => switchPanel('forgot'));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && authModalOpen) closeAuthModal();
    });

    const endpointFor = {
        login: '/api/auth/login',
        signup: '/api/auth/register',
        forgot: '/api/forgot-password'
    };
    overlay.querySelectorAll('.auth-form').forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const panel = form.getAttribute('data-auth-panel');
            const status = form.querySelector('[data-form-status]');
            setFormStatus(form, panel === 'login' ? 'Signing you in…' : 'Creating your account…', '');
            try {
                const body = Object.fromEntries(new FormData(form).entries());
                await api(endpointFor[panel], { method: 'POST', body: JSON.stringify(body) });
                closeAuthModal();
                await refreshClientSession();
                showToast(panel === 'login' ? 'Signed in.' : 'Account created. Welcome!');
                if (pendingConsultationSubmit) {
                    pendingConsultationSubmit = false;
                    submitConsultationForm();
                }
                if (window.location.pathname === '/client.html' && typeof renderClientDashboard === 'function') {
                    renderClientDashboard();
                }
            } catch (error) {
                setFormStatus(form, error.message, 'error');
            }
        });
    });
    overlay.querySelector('#auth-forgot-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const status = form.querySelector('[data-form-status]');
        setFormStatus(form, 'Sending reset link…', '');
        try {
            const data = await api('/api/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email: form.email.value })
            });
            setFormStatus(form, data.devResetLink ? `Development mode: ${data.devResetLink}` : (data.message || 'If an account exists for this email, a reset link has been sent.'), 'success');
        } catch (error) {
            setFormStatus(form, error.message, 'error');
        }
    });

    switchPanel(defaultTab === 'signup' ? 'signup' : 'login');
    renderGoogleSection(overlay);
    const firstInput = overlay.querySelector(`[data-auth-panel="${defaultTab === 'signup' ? 'signup' : 'login'}"] input`);
    if (firstInput && firstInput.focus) firstInput.focus();
}

/* ---------------- Google sign-in (GSI) ---------------- */

let wnGoogleClientId = '';
let wnGoogleInit = null;

function ensureGoogleScriptLoaded() {
    if (window.google && window.google.accounts) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Could not load Google sign-in.'));
        document.body.appendChild(script);
    });
}

function initGoogleClient() {
    if (wnGoogleInit) return wnGoogleInit;
    wnGoogleInit = (async () => {
        try {
            const config = await api('/api/auth/config');
            wnGoogleClientId = config.googleClientId || '';
        } catch (_error) {
            wnGoogleClientId = '';
        }
        if (!wnGoogleClientId) return;
        await ensureGoogleScriptLoaded();
        window.google.accounts.id.initialize({
            client_id: wnGoogleClientId,
            callback: (response) => handleGoogleCredential(response.credential),
            auto_select: false,
            cancel_on_tap_outside: true
        });
    })();
    return wnGoogleInit;
}

async function handleGoogleCredential(credential) {
    if (!credential) return;
    try {
        const data = await api('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
        if (data.role && data.role !== 'client') {
            showToast('This email belongs to a WorldNet staff account — sign in through the team portal instead.');
            return;
        }
        if (data.client) wnClient = data.client;
        closeAuthModal();
        await refreshClientSession();
        const message = data.created
            ? 'Account created with Google — welcome!'
            : (data.linked ? 'Existing account linked to Google. Signed in.' : 'Signed in with Google.');
        showToast(message);
        if (pendingConsultationSubmit) {
            pendingConsultationSubmit = false;
            submitConsultationForm();
        }
        if (window.location.pathname === '/client.html' && typeof renderClientDashboard === 'function') {
            renderClientDashboard();
        }
    } catch (error) {
        showToast(error.message);
    }
}

async function renderGoogleSection(overlay) {
    const block = overlay.querySelector('[data-google-item]');
    const container = overlay.querySelector('[data-google-signin]');
    if (!block || !container) return;
    await initGoogleClient();
    if (!wnGoogleClientId) return;
    block.hidden = false;
    try {
        const width = Math.min(Math.max(container.clientWidth || 340, 280), 360);
        window.google.accounts.id.renderButton(container, {
            type: 'standard', shape: 'pill', theme: 'outline', text: 'continue_with', size: 'large', width
        });
    } catch (_error) { /* swallowed: button render options differ by GSI version */ }
}

function closeAuthModal() {
    const overlay = document.querySelector('.auth-overlay');
    if (overlay) overlay.remove();
    document.body.classList.remove('modal-open');
    authModalOpen = false;
}

document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-sign-in-any]');
    if (!trigger) return;
    event.preventDefault();
    openAuthModal('login');
});

/* ---------------- Consultation request form ---------------- */

async function setupConsultationForm() {
    const form = document.getElementById('consultation-form');
    if (!form) return;
    autosaveForm(form, 'wn-draft:consultation-form');

    const serviceSelect = form.querySelector('[name="service_type"]');
    if (serviceSelect) {
        try {
            const services = await api('/api/services');
            serviceSelect.innerHTML = [
                '<option value="">Select a service…</option>',
                ...services.map((service) => `<option value="${escapeHtml(service.name)}">${escapeHtml(service.name)}</option>`)
            ].join('');
            const params = new URLSearchParams(window.location.search);
            const serviceParam = params.get('service');
            if (serviceParam) {
                const match = services.find((service) => service.slug === serviceParam || service.id === serviceParam);
                if (match) serviceSelect.value = match.name;
            }
        } catch (_error) { /* services stay empty; user can type */ }
    }

    renderConsultationIdentity();
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        clearFieldErrors(form);
        const missingFields = fieldErrors(form, ['service_type', 'preferred_contact']);
        if (missingFields.length) {
            for (const { element, message } of missingFields) markFieldError(element, element.name, message);
            const firstInvalid = missingFields[0].element;
            if (firstInvalid.focus) firstInvalid.focus();
            setFormStatus(form, 'Please choose a service and a preferred contact method.', 'error');
            return;
        }
        if (!wnClient) {
            pendingConsultationSubmit = true;
            openAuthModal('login');
            return;
        }
        submitConsultationForm(form);
    });
    form.addEventListener('input', (event) => {
        if (event.target && event.target.getAttribute('aria-invalid') === 'true') {
            const errorEl = event.target.getAttribute('aria-describedby') ? document.getElementById(event.target.getAttribute('aria-describedby')) : null;
            if (errorEl) errorEl.remove();
            event.target.removeAttribute('aria-invalid');
        }
    });
}

function renderConsultationIdentity() {
    const container = document.querySelector('[data-requesting-as]');
    if (!container) return;
    if (wnClient) {
        container.innerHTML = `
            <div class="requesting-as">
              <span class="guest-pill-dot" aria-hidden="true"></span>
              Requesting as <strong>${escapeHtml(wnClient.fullName)}</strong> (${escapeHtml(wnClient.email)}${wnClient.companyName ? ` · ${escapeHtml(wnClient.companyName)}` : ''})
            </div>`;
    } else {
        container.innerHTML = `
            <div class="requesting-as muted">
              You will be asked to sign in once to submit. Your details are filled in from your account.
              <button type="button" class="linklike" data-sign-in-for-request>Sign in now</button>
            </div>`;
        const signInButton = container.querySelector('[data-sign-in-for-request]');
        if (signInButton) {
            signInButton.addEventListener('click', () => openAuthModal('login'));
        }
    }
}

async function submitConsultationForm(form) {
    if (form && !form.checkValidity()) {
        setFormStatus(form, 'Please fix the highlighted fields.', 'error');
        return;
    }
    const activeForm = form || document.getElementById('consultation-form');
    if (!activeForm) return;
    const submitButton = activeForm.querySelector('button[type="submit"]');
    const originalText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting…';
    }
    try {
        const data = new FormData(activeForm);
        const body = {
            service_type: String(data.get('service_type') || '').trim(),
            preferred_contact: String(data.get('preferred_contact') || '').trim() || 'email',
            preferred_timeframe: String(data.get('preferred_timeframe') || '').trim(),
            notes: String(data.get('notes') || '').trim()
        };
        await api('/api/consultations', { method: 'POST', body: JSON.stringify(body) });
        activeForm.reset();
        clearAutosave('wn-draft:consultation-form');
        clearFieldErrors(activeForm);
        renderConsultationConfirmation(activeForm, body);
        showToast('Your consultation request was received.');
    } catch (error) {
        if (error.message && /sign in/i.test(error.message)) {
            pendingConsultationSubmit = true;
            openAuthModal('login');
        } else {
            setFormStatus(activeForm, error.message || 'Your request could not be submitted. Your details are still on this form, please try again.', 'error');
            showToast(error.message);
        }
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }
}

function renderConsultationConfirmation(form, body) {
    const card = form.closest('.card');
    if (!card) return;
    card.innerHTML = `
        <div class="confirmation">
          <span class="confirmation-check" aria-hidden="true">✓</span>
          <h2>Request received</h2>
          <p>Thanks ${escapeHtml(wnClient ? wnClient.fullName.split(' ')[0] : '')}. Your consultation request for <strong>${escapeHtml(body.service_type)}</strong> is now under review.</p>
          <p class="muted">We will contact you via ${body.preferred_contact === 'phone' ? 'phone' : 'email'}${body.preferred_timeframe ? ` and aim to follow up ${escapeHtml((CLIENT_TIMEFRAME_LABELS[body.preferred_timeframe] || body.preferred_timeframe).toLowerCase())}` : ''}.</p>
          <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:1rem">
            <a class="btn btn-primary" href="/client.html">View your requests</a>
            <button type="button" class="btn btn-secondary" data-new-request>Request another</button>
          </div>
        </div>`;
    card.querySelector('[data-new-request]').addEventListener('click', () => window.location.reload());
}

function animateCounters() {
    document.querySelectorAll('[data-count-to]').forEach((element) => {
        const target = Number.parseFloat(element.dataset.countTo || '0');
        const decimals = Number.parseInt(element.dataset.decimals || '0', 10);
        const suffix = element.dataset.suffix || '';
        const prefix = element.dataset.prefix || '';
        const duration = 1200;
        const startedAt = performance.now();

        const tick = (now) => {
            const progress = Math.min((now - startedAt) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = target * eased;
            element.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;
            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                element.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
            }
        };

        requestAnimationFrame(tick);
    });
}

function setupScrollReveal() {
    const revealTargets = Array.from(document.querySelectorAll('.card, .stat, .hero-copy, .hero-panel'));
    const sections = new Map();

    revealTargets.forEach((element) => {
        const section = element.closest('.section, .hero, .hero-secondary') || document.body;
        const group = sections.get(section) || [];
        group.push(element);
        sections.set(section, group);
    });

    sections.forEach((items) => {
        items.forEach((item, index) => {
            item.style.transitionDelay = `${index * 90}ms`;
            item.style.transitionDuration = '640ms';
        });
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
                setTimeout(() => {
                    entry.target.classList.remove('reveal', 'is-visible');
                    entry.target.style.transitionDelay = '';
                    entry.target.style.transitionDuration = '';
                }, 820);
            }
        });
    }, { threshold: 0.2 });

    revealTargets.forEach((element) => {
        element.classList.add('reveal');
        observer.observe(element);
    });
}

function shouldPreferReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function updateDecorativeAnimationState() {
    const paused = document.hidden;
    const elements = document.querySelectorAll('.hero-shape, .hero-marquee-item');
    elements.forEach((element) => {
        element.style.animationPlayState = paused ? 'paused' : 'running';
    });
}

function setupVisibilityAnimationPause() {
    if (shouldPreferReducedMotion()) return;
    document.addEventListener('visibilitychange', updateDecorativeAnimationState);
    updateDecorativeAnimationState();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setActiveNav();
        setupMobileNav();
        setupNavDropdowns();
        setupHeaderScrollState();
        animateCounters();
        setupScrollReveal();
        setupVisibilityAnimationPause();
        setupHeroParallax();
        document.body.classList.add('page-ready');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => document.body.classList.add('hero-animating'));
        });
        prefillInquiryForm();
        loadHomeServices();
        loadServicesPage();
        loadServiceDetails();
        loadPortfolio();
        loadPortfolioDetails();
        refreshClientSession();
        setupConsultationForm();
        submitForm('inquiry-form', '/api/inquiries');
        trackConsultationRequest();
        setMinConsultationDate();
    });
}
