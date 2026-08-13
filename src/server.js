import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { closeDatabase, loadDatabase, saveDatabase } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'worldnet-dev-secret';
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false });
const formLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

const initialServices = [
    {
        id: 'svc-001',
        name: 'Enterprise Networking',
        slug: 'enterprise-networking',
        category: 'Infrastructure',
        summary: 'Resilient LAN/WAN architecture with structured cabling and zero-downtime design.',
        description: 'We design, deploy, and support high-availability network infrastructure for banks, ministries, hospitals, and large campuses.',
        icon: 'waypoints',
        features: ['LAN/WAN design', 'Structured cabling', 'Redundant switching'],
        deliverables: 'Network assessment, deployment plan, phased migration, SLA support',
        priceRange: 'Custom quote'
    },
    {
        id: 'svc-002',
        name: 'Fiber Optic Installation',
        slug: 'fiber-optic-installation',
        category: 'Connectivity',
        summary: 'Campus and metro fiber deployment with certified termination and testing.',
        description: 'Our certified field engineers deliver end-to-end fiber splicing, testing, and documentation for reliable long-haul connectivity.',
        icon: 'cable',
        features: ['Splicing', 'OTDR testing', 'Campus backbone'],
        deliverables: 'Site survey, fiber design, testing report, maintenance plan',
        priceRange: 'Custom quote'
    },
    {
        id: 'svc-003',
        name: 'Cybersecurity',
        slug: 'cybersecurity',
        category: 'Security',
        summary: 'Threat monitoring, penetration testing, and compliance-ready frameworks.',
        description: 'We deliver proactive security operations, vulnerability assessments, and incident response strategies.',
        icon: 'shield-check',
        features: ['SOC monitoring', 'Pen tests', 'Compliance support'],
        deliverables: 'Security audit, remediation roadmap, SOC onboarding',
        priceRange: 'Custom quote'
    },
    {
        id: 'svc-004',
        name: 'Cloud Solutions',
        slug: 'cloud-solutions',
        category: 'Cloud',
        summary: 'Hybrid and multi-cloud migration, architecture, and cost optimization.',
        description: 'Move critical workloads to Azure or AWS with a secure architecture and a clear modernization roadmap.',
        icon: 'cloud',
        features: ['Azure/AWS architecture', 'Migration plan', 'Cost optimization'],
        deliverables: 'Cloud readiness assessment, migration plan, post-go-live support',
        priceRange: 'Custom quote'
    }
];

const initialPortfolio = [
    {
        id: 'pf-001',
        title: 'Core Banking Network Overhaul',
        client: 'Meridian Bank',
        category: 'Banking & Finance',
        description: 'Upgraded the bank-wide network with redundant switching and fiber backbones across 12 branches.',
        outcome: '60% lower latency and stronger resilience.'
    },
    {
        id: 'pf-002',
        title: 'Ministry SOC & Threat Monitoring',
        client: 'Government Agency',
        category: 'Government',
        description: 'Built a 24/7 security operations capability with real-time alerting and playbooks.',
        outcome: 'Zero breaches in 18 months.'
    }
];

const initialData = {
    services: initialServices,
    portfolio: initialPortfolio,
    inquiries: [],
    consultations: [],
    notifications: [],
    workers: [
        { id: 'wrk-001', name: 'Ama Boateng', department: 'Infrastructure', role: 'Network Engineer' },
        { id: 'wrk-002', name: 'Kofi Mensah', department: 'Security', role: 'Security Analyst' },
        { id: 'wrk-003', name: 'Nadia Ali', department: 'Cloud', role: 'Solutions Architect' }
    ],
    admins: [
        {
            id: 'adm-001',
            name: 'System Admin',
            email: 'admin@worldnetict.com',
            passwordHash: bcrypt.hashSync('admin123', 10),
            role: 'admin'
        }
    ],
    settings: {
        companyName: 'WorldNet ICT Solutions',
        contactEmail: 'hello@worldnetict.com',
        contactPhone: '+233 20 000 0000'
    }
};

let state = { ...initialData };
let saveQueue = Promise.resolve();
const recentSubmissions = new Map();

async function loadState() {
    try {
        state = await loadDatabase(initialData, { reset: process.env.NODE_ENV === 'test' });
    } catch (error) {
        console.error('Database could not be initialized.', error.message);
        throw error;
    }
}

async function saveState() {
    const snapshot = structuredClone(state);
    saveQueue = saveQueue.then(() => saveDatabase(snapshot));
    return saveQueue;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

function authRequired(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        req.admin = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function duplicateCheck(key, ttlMs = 5 * 60 * 1000) {
    const now = Date.now();
    const previous = recentSubmissions.get(key);
    if (previous && now - previous < ttlMs) {
        return true;
    }
    recentSubmissions.set(key, now);
    return false;
}

async function sendEmail({ to, subject, text, html }) {
    if (!process.env.SMTP_HOST) {
        console.log(`[email] skipped -> ${subject}`);
        return { ok: true, skipped: true };
    }
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    return transporter.sendMail({ from: process.env.SMTP_FROM || 'no-reply@worldnetict.com', to, subject, text, html });
}

function createNotification(type, payload, title, message) {
    const notification = {
        id: `notif-${crypto.randomBytes(3).toString('hex')}`,
        type,
        title,
        message,
        relatedId: payload.id,
        read: false,
        createdAt: new Date().toISOString()
    };
    state.notifications.unshift(notification);
    return notification;
}

async function notifySubmission(type, payload) {
    const subject = type === 'inquiry' ? 'New inquiry received' : 'New consultation requested';
    const text = `${subject}\nName: ${payload.name}\nEmail: ${payload.email}\nPhone: ${payload.phone}\n${payload.service_type ? `Service: ${payload.service_type}` : ''}`;
    await sendEmail({
        to: state.settings.contactEmail,
        subject,
        text,
        html: `<p>${escapeHtml(subject)}</p><pre>${escapeHtml(text)}</pre>`
    });
    await sendEmail({
        to: payload.email,
        subject: `Thanks for contacting ${state.settings.companyName}`,
        text: `Hello ${payload.name}, thank you for reaching out. We will contact you shortly.`,
        html: `<p>Hello ${escapeHtml(payload.name)},</p><p>Thanks for contacting ${escapeHtml(state.settings.companyName)}. We will be in touch shortly.</p>`
    });
}

app.get('/api/health', (_req, res) => res.json({ ok: true, message: 'WorldNet Sprint 1 API is running' }));

function getActiveServices() {
    return state.services.filter((service) => !service.deleted);
}

app.get('/api/services', (req, res) => {
    const { category, limit } = req.query;
    let items = getActiveServices();
    if (category) {
        items = items.filter((service) => service.category.toLowerCase() === String(category).toLowerCase());
    }
    if (limit) {
        items = items.slice(0, Number(limit));
    }
    res.json(items);
});

app.get('/api/services/:id', (req, res) => {
    const item = getActiveServices().find((service) => service.id === req.params.id || service.slug === req.params.id);
    if (!item) return res.status(404).json({ error: 'Service not found' });
    res.json(item);
});

app.post('/api/services', authRequired, async (req, res) => {
    const { name, category, summary, description, icon, features, deliverables, priceRange } = req.body;
    if (!name || !category || !summary) return res.status(400).json({ error: 'Name, category, and summary are required.' });
    const service = {
        id: `svc-${crypto.randomBytes(3).toString('hex')}`,
        slug: String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        name: sanitizeText(name),
        category: sanitizeText(category),
        summary: sanitizeText(summary),
        description: sanitizeText(description || summary),
        icon: sanitizeText(icon || 'server'),
        features: Array.isArray(features) ? features.map((f) => sanitizeText(f)) : [],
        deliverables: sanitizeText(deliverables || 'Custom implementation plan'),
        priceRange: sanitizeText(priceRange || 'Custom quote')
    };
    state.services.unshift(service);
    await saveState();
    res.status(201).json(service);
});

app.put('/api/services/:id', authRequired, async (req, res) => {
    const index = state.services.findIndex((service) => service.id === req.params.id || service.slug === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Service not found' });
    const updated = { ...state.services[index], ...req.body, id: state.services[index].id, slug: req.body.slug || state.services[index].slug };
    state.services[index] = updated;
    await saveState();
    res.json(updated);
});

app.delete('/api/services/:id', authRequired, async (req, res) => {
    const index = state.services.findIndex((service) => service.id === req.params.id || service.slug === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Service not found' });
    state.services[index] = { ...state.services[index], deleted: true, deletedAt: new Date().toISOString() };
    await saveState();
    res.json({ ok: true });
});

app.get('/api/portfolio', (_req, res) => res.json(state.portfolio));

app.post('/api/portfolio', authRequired, async (req, res) => {
    const { title, client, category, description, outcome } = req.body;
    if (!title || !client || !category) return res.status(400).json({ error: 'Title, client, and category are required.' });
    const item = {
        id: `pf-${crypto.randomBytes(3).toString('hex')}`,
        title: sanitizeText(title),
        client: sanitizeText(client),
        category: sanitizeText(category),
        description: sanitizeText(description || ''),
        outcome: sanitizeText(outcome || '')
    };
    state.portfolio.unshift(item);
    await saveState();
    res.status(201).json(item);
});

app.delete('/api/portfolio/:id', authRequired, async (req, res) => {
    const index = state.portfolio.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Portfolio item not found' });
    state.portfolio.splice(index, 1);
    await saveState();
    res.json({ ok: true });
});

app.get('/api/inquiries', authRequired, (_req, res) => res.json(state.inquiries));

app.post('/api/inquiries', formLimiter, async (req, res) => {
    const { name, company, email, phone, service_type, message } = req.body;
    if (!name || !email || !phone || !service_type || !message) return res.status(400).json({ error: 'Please complete every required field.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const submissionKey = `${email}:${phone}:${service_type}`.toLowerCase();
    if (duplicateCheck(submissionKey)) return res.status(409).json({ error: 'A similar request was submitted recently. Please wait a moment and try again.' });

    const inquiry = {
        id: `inq-${crypto.randomBytes(3).toString('hex')}`,
        name: sanitizeText(name),
        company: sanitizeText(company || ''),
        email: sanitizeText(email).toLowerCase(),
        phone: sanitizeText(phone),
        service_type: sanitizeText(service_type),
        message: sanitizeText(message),
        status: 'new',
        handledBy: '',
        handledAt: '',
        createdAt: new Date().toISOString()
    };
    state.inquiries.unshift(inquiry);
    createNotification('inquiry', inquiry, 'New inquiry received', `${inquiry.name} submitted a new request for ${inquiry.service_type}.`);
    await saveState();
    await notifySubmission('inquiry', inquiry);
    res.status(201).json({ ok: true, inquiry });
});

app.put('/api/inquiries/:id', authRequired, async (req, res) => {
    const index = state.inquiries.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Inquiry not found' });
    const handledBy = req.admin?.name ? String(req.admin.name) : (req.body.handledBy || state.inquiries[index].handledBy || '');
    const handledAt = handledBy && !state.inquiries[index].handledBy ? new Date().toISOString() : (req.body.handledAt || state.inquiries[index].handledAt || '');
    state.inquiries[index] = {
        ...state.inquiries[index],
        ...req.body,
        handledBy,
        handledAt
    };
    await saveState();
    res.json(state.inquiries[index]);
});

app.put('/api/inquiries/:id/withdraw', async (req, res) => {
    const index = state.inquiries.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Inquiry not found' });
    state.inquiries[index] = { ...state.inquiries[index], status: 'withdrawn' };
    await saveState();
    res.json(state.inquiries[index]);
});

app.get('/api/consultations', authRequired, (_req, res) => res.json(state.consultations));

app.get('/api/consultations/track', async (req, res) => {
    const { email, phone } = req.query;
    if (!email || !phone) {
        return res.status(400).json({ error: 'Email and phone are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = String(phone).trim();
    const consultation = state.consultations.find((item) => {
        return item.email === normalizedEmail && item.phone === normalizedPhone;
    });

    if (!consultation) {
        return res.status(404).json({ error: 'No consultation request found for that email and phone.' });
    }

    res.json({
        ok: true,
        consultation: {
            id: consultation.id,
            name: consultation.name,
            preferred_date: consultation.preferred_date,
            preferred_time: consultation.preferred_time,
            status: consultation.status,
            handledBy: consultation.handledBy || '',
            createdAt: consultation.createdAt
        }
    });
});

app.put('/api/consultations/:id', authRequired, async (req, res) => {
    const index = state.consultations.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Consultation not found' });
    const handledBy = req.admin?.name ? String(req.admin.name) : (req.body.handledBy || state.consultations[index].handledBy || '');
    const handledAt = handledBy && !state.consultations[index].handledBy ? new Date().toISOString() : (req.body.handledAt || state.consultations[index].handledAt || '');
    state.consultations[index] = {
        ...state.consultations[index],
        ...req.body,
        assignedDepartment: req.body.assignedDepartment || state.consultations[index].assignedDepartment || '',
        assignedWorker: req.body.assignedWorker || state.consultations[index].assignedWorker || '',
        handledBy,
        handledAt
    };
    await saveState();
    res.json(state.consultations[index]);
});

app.put('/api/consultations/:id/withdraw', async (req, res) => {
    const index = state.consultations.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Consultation not found' });
    const email = sanitizeText(req.body?.email).toLowerCase();
    const phone = sanitizeText(req.body?.phone);
    if (!email || !phone || state.consultations[index].email !== email || state.consultations[index].phone !== phone) {
        return res.status(403).json({ error: 'You can only withdraw your own consultation request.' });
    }
    state.consultations[index] = { ...state.consultations[index], status: 'withdrawn' };
    await saveState();
    res.json(state.consultations[index]);
});

app.post('/api/consultations', formLimiter, async (req, res) => {
    const { name, company, email, phone, preferred_date, preferred_time, notes } = req.body;
    if (!name || !email || !phone || !preferred_date || !preferred_time) return res.status(400).json({ error: 'Please complete every required consultation field.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const submissionKey = `${email}:${phone}:${preferred_date}:${preferred_time}`.toLowerCase();
    if (duplicateCheck(submissionKey)) return res.status(409).json({ error: 'A similar consultation request was submitted recently.' });
    const consultation = {
        id: `con-${crypto.randomBytes(3).toString('hex')}`,
        name: sanitizeText(name),
        company: sanitizeText(company || ''),
        email: sanitizeText(email).toLowerCase(),
        phone: sanitizeText(phone),
        preferred_date: sanitizeText(preferred_date),
        preferred_time: sanitizeText(preferred_time),
        notes: sanitizeText(notes || ''),
        status: 'pending',
        assignedDepartment: '',
        assignedWorker: '',
        handledBy: '',
        handledAt: '',
        createdAt: new Date().toISOString()
    };
    state.consultations.unshift(consultation);
    createNotification('consultation', consultation, 'New consultation request', `${consultation.name} requested a consultation for ${consultation.preferred_date} at ${consultation.preferred_time}.`);
    await saveState();
    await notifySubmission('consultation', consultation);
    res.status(201).json({ ok: true, consultation });
});

app.post('/api/appointments', formLimiter, async (req, res) => {
    const { name, company, email, phone, preferred_date, preferred_time, notes } = req.body;
    if (!name || !email || !phone || !preferred_date || !preferred_time) {
        return res.status(400).json({ error: 'Please complete every required appointment field.' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

    const selectedDate = new Date(`${preferred_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
        return res.status(400).json({ error: 'Please choose a future date.' });
    }

    const appointment = {
        id: `apt-${crypto.randomBytes(3).toString('hex')}`,
        name: sanitizeText(name),
        company: sanitizeText(company || ''),
        email: sanitizeText(email).toLowerCase(),
        phone: sanitizeText(phone),
        preferred_date: sanitizeText(preferred_date),
        preferred_time: sanitizeText(preferred_time),
        notes: sanitizeText(notes || ''),
        status: 'pending',
        handledBy: '',
        handledAt: '',
        createdAt: new Date().toISOString()
    };
    state.consultations.unshift(appointment);
    createNotification('consultation', appointment, 'New appointment request', `${appointment.name} requested an appointment for ${appointment.preferred_date} at ${appointment.preferred_time}.`);
    await saveState();
    await notifySubmission('consultation', appointment);
    res.status(201).json({ ok: true, appointment });
});

app.get('/api/admin/stats', authRequired, (_req, res) => {
    res.json({
        services: getActiveServices().length,
        inquiries: state.inquiries.length,
        consultations: state.consultations.length,
        portfolio: state.portfolio.length,
        admins: state.admins.length,
        workers: state.workers.length,
        notifications: state.notifications.filter((item) => !item.read).length
    });
});

app.get('/api/admin/notifications', authRequired, (_req, res) => res.json(state.notifications));

app.put('/api/admin/notifications/:id/read', authRequired, async (req, res) => {
    const notification = state.notifications.find((item) => item.id === req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    notification.read = true;
    await saveState();
    res.json(notification);
});

app.get('/api/admin/users', authRequired, (_req, res) => res.json(state.admins));
app.get('/api/admin/workers', authRequired, (_req, res) => res.json(state.workers));

app.post('/api/admin/workers', authRequired, async (req, res) => {
    const name = sanitizeText(req.body.name);
    const department = sanitizeText(req.body.department);
    const role = sanitizeText(req.body.role);
    if (!name || !department || !role) {
        return res.status(400).json({ error: 'Name, department, and role are required.' });
    }
    if (state.workers.some((worker) => worker.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ error: 'A worker with that name already exists.' });
    }
    const worker = { id: `wrk-${crypto.randomBytes(3).toString('hex')}`, name, department, role };
    state.workers.push(worker);
    await saveState();
    res.status(201).json(worker);
});

app.delete('/api/admin/workers/:id', authRequired, async (req, res) => {
    const index = state.workers.findIndex((worker) => worker.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Worker not found' });
    const [worker] = state.workers.splice(index, 1);
    state.consultations = state.consultations.map((consultation) => (
        consultation.assignedWorker === worker.name
            ? { ...consultation, assignedWorker: '' }
            : consultation
    ));
    await saveState();
    res.json({ ok: true, worker });
});

app.post('/api/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const admin = state.admins.find((item) => item.email.toLowerCase() === String(email).toLowerCase());
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = bcrypt.compareSync(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = createToken({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
    res.json({ ok: true, token, admin: { id: admin.id, name: admin.name, email: admin.email } });
});

app.post('/api/logout', (_req, res) => res.json({ ok: true }));

app.get('/api/settings', (_req, res) => res.json(state.settings));

app.put('/api/settings', authRequired, async (req, res) => {
    state.settings = { ...state.settings, ...req.body };
    await saveState();
    res.json(state.settings);
});

app.get('/services/:id', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'service-details.html'));
});

app.get('/portfolio-details/:id', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'portfolio-details.html'));
});

app.use(express.static(PUBLIC_DIR));

app.get('*', (_req, res) => {
    if (_req.accepts('html')) {
        res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
        return;
    }
    res.status(404).json({ error: 'Not found' });
});

async function startServer(port = PORT) {
    await loadState();
    return app.listen(port, () => console.log(`WorldNet Sprint 1 server running on http://localhost:${port}`));
}

if (process.env.NODE_ENV !== 'test') {
    startServer().catch((error) => {
        console.error('Failed to start server', error);
        process.exit(1);
    });
}

export { app, startServer, closeDatabase };
