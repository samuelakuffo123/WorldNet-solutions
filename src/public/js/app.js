const pages = {
    '/': 'Home',
    '/services.html': 'Services',
    '/service-details.html': 'Services',
    '/about.html': 'About',
    '/portfolio.html': 'Portfolio',
    '/team.html': 'Our team',
    '/contact.html': 'Contact',
    '/consultation.html': 'Consultation'
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
    const update = () => header.classList.toggle('scrolled', window.scrollY > 10);
    update();
    window.addEventListener('scroll', update, { passive: true });
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
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

function validateForm(form, requiredFields) {
    return requiredFields.filter((field) => {
        const fieldElement = form.querySelector(`[name="${field}"]`);
        if (!fieldElement) return false;
        return !String(fieldElement.value || '').trim();
    });
}

async function api(path, options = {}) {
    const response = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
    });
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
          <a class="btn btn-secondary" href="/consultation.html">Book a consultation</a>
        </div>
      </div>`;
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

async function submitForm(formId, endpoint) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const requiredFields = formId === 'consultation-form'
            ? ['name', 'email', 'phone', 'preferred_date', 'preferred_time']
            : ['name', 'email', 'phone', 'service_type', 'message'];
        const missingFields = validateForm(form, requiredFields);
        if (missingFields.length) {
            setFormStatus(form, `Please complete: ${missingFields.join(', ')}`, 'error');
            showToast('Please complete the required fields.');
            return;
        }
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton ? submitButton.textContent : '';
        if (submitButton) submitButton.textContent = 'Submitting…';
        try {
            const formData = Object.fromEntries(new FormData(form).entries());
            await api(endpoint, { method: 'POST', body: JSON.stringify(formData) });
            form.reset();
            if (formId === 'inquiry-form') {
                prefillInquiryForm();
            }
            setFormStatus(form, 'Thanks! Your request was received and we will follow up shortly.', 'success');
            showToast('Thanks! Your request was received.');
        } catch (error) {
            setFormStatus(form, error.message || 'Submission failed. Please try again.', 'error');
            showToast(error.message);
        } finally {
            if (submitButton) submitButton.textContent = originalText;
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
            const status = data.consultation.status === 'pending' ? 'Pending' : 'Viewed';
            const badgeClass = data.consultation.status === 'pending' ? 'pending-badge' : 'viewed-badge';
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
                }, 780);
            }
        });
    }, { threshold: 0.14 });

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
        document.body.classList.add('page-ready');
        prefillInquiryForm();
        loadHomeServices();
        loadServicesPage();
        loadServiceDetails();
        loadPortfolio();
        loadPortfolioDetails();
        submitForm('inquiry-form', '/api/inquiries');
        submitForm('consultation-form', '/api/consultations');
        trackConsultationRequest();
    });
}
