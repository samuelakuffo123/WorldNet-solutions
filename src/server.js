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
import { config } from './config.js';
import { logger, requestLogger } from './logger.js';
import {
    validateFields,
    validateName,
    validateText,
    isValidEmail,
    canTransition,
    validateStatus,
    REPORT_STATUSES,
    CONSULTATION_STATUSES
} from './validation.js';
import {
    parseCookies,
    setSessionCookies,
    clearSessionCookies,
    csrfProtect,
    securityHeaders,
    sanitizeFileName,
    fileKeyFor,
    fileExists,
    readFileBuffer,
    unlinkFile,
    pruneStoredFiles,
    decodeDataUrl,
    storeFile
} from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
app.set('trust proxy', 1);
app.use(requestLogger);
app.use(securityHeaders);
app.use(cors({
    origin: config.corsOrigins.length
        ? (origin, callback) => {
            if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
        }
        : false,
    credentials: true
}));
app.use(express.json({ limit: config.isProduction ? '4mb' : '16mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(resolveAuth);
app.use(csrfProtect);

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'test' ? 1000 : 12, standardHeaders: true, legacyHeaders: false });
const formLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: process.env.NODE_ENV === 'test' ? 1000 : 60, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'test' ? 1000 : 12, standardHeaders: true, legacyHeaders: false });

const initialServices = [
    {
        id: 'svc-001',
        name: 'Network Infrastructure Design & Cabling',
        slug: 'network-infrastructure-cabling',
        category: 'Infrastructure',
        summary: 'Structured cabling (UTP, STP, Fiber), LAN/WAN design, and network deployment for enterprises and campuses.',
        description: 'We design and install network infrastructure end-to-end — structured cabling in UTP, STP and fiber, LAN and WAN networks over radio and fiber, and the full routing, switching and firewall layers. Our teams have delivered networks for institutions that include GCB, AngloGold Ashanti, Ghana Telecom (now Vodafone), SSNIT, VRA, Ecobank, Tullow Ghana and the Council of State.',
        icon: 'waypoints',
        features: ['Structured cabling (UTP, STP, Fiber)', 'LAN / WAN design and implementation', 'Routing, switching & firewall', 'Campus and building backbone upgrades'],
        deliverables: 'Network assessment, cabling plan, phased migration plan, testing report, handover documentation',
        priceRange: 'Custom quote'
    },
    {
        id: 'svc-002',
        name: 'Fiber Optic Installation',
        slug: 'fiber-optic-installation',
        category: 'Connectivity',
        summary: 'Fiber backbone design, installation, splicing and testing, from campuses to long-haul corridors.',
        description: 'We deliver campus and long-haul fiber — backbone link design, splicing, termination and certification. WorldNet has worked on corridor-scale projects including the Eastern Corridor Fiber Optic Project from Accra to Bawku and backbone links for KNUST Sunyani campus, with links taking internet backbones from 8Mbps on copper to 45Mbps on fiber.',
        icon: 'cable',
        features: ['Fiber backbone design & installation', 'Splicing, termination & testing', 'WiMAX and radio network deployment', 'Backbone capacity upgrades'],
        deliverables: 'Site survey, fiber design, splicing & test report, maintenance plan',
        priceRange: 'Custom quote'
    },
    {
        id: 'svc-003',
        name: 'Cybersecurity & Systems Security',
        slug: 'cybersecurity',
        category: 'Security',
        summary: 'Systems security, anti-virus support, physical security and surveillance to protect business operations.',
        description: 'We secure networks and systems — security audits, anti-virus support, firewalls and VPNs, and physical security & surveillance. Our engineers have configured SonicWall, Cyberoam and Smoothwall firewalls and secured environments ranging from financial systems to government networks.',
        icon: 'shield-check',
        features: ['Security audits & assessments', 'Firewall and VPN configuration', 'Anti-virus and endpoint support', 'Physical security & surveillance'],
        deliverables: 'Security audit, hardening plan, firewall/VPN configuration, support coverage',
        priceRange: 'Custom quote'
    },
    {
        id: 'svc-004',
        name: 'Data Centre & Power Systems',
        slug: 'data-centre-power',
        category: 'Cloud & Data Centre',
        summary: 'Design and implementation of tiered data centres, electrical power systems and NOC support.',
        description: 'We design and implement tiered data centres, electrical power systems design & installation, and NOC/data centre support services. The WorldNet group includes EPN Ltd (power systems specialists) and delivers power protection support, UPS repairs and managed server environments for financial institutions.',
        icon: 'server',
        features: ['Tiered data centre design & implementation', 'Electrical power systems design & installation', 'NOC / data centre support', 'Power protection & UPS support'],
        deliverables: 'Data centre design, power plan, implementation, NOC support services',
        priceRange: 'Custom quote'
    },
    {
        id: 'svc-005',
        name: 'Managed Support & Maintenance Contracts',
        slug: 'managed-support-maintenance',
        category: 'Managed Services',
        summary: 'Servicing and maintenance contracts, field and onsite engineering, remote support and repairs.',
        description: 'We provide onsite and field engineering services, remote support, servicing and maintenance contracts for computers and peripherals — including printer, monitor and UPS repairs. Day-to-day system support and trouble-shooting cover desktops, laptops, servers and networks.',
        icon: 'wrench',
        features: ['Servicing & maintenance contracts', 'Field and onsite engineering services', 'Remote support services', 'Printer, monitor & UPS repairs'],
        deliverables: 'Support contract, SLAs, maintenance schedule, repairs & parts coverage',
        priceRange: 'Custom quote'
    },
    {
        id: 'svc-006',
        name: 'Software Engineering',
        slug: 'software-engineering',
        category: 'Software Engineering',
        summary: 'In-house development of banking, government and business applications with ongoing support.',
        description: 'We build custom applications — from SmartBank branch banking software and loan tracking systems to the Government of Ghana Index Linked Bond (GGILB) software and securities systems for the Securities and Exchange Commission. We support SQL Server, MySQL and Oracle platforms.',
        icon: 'code',
        features: ['Custom application development', 'Banking & financial software', 'Government & securities systems', 'SQL Server, MySQL, Oracle support'],
        deliverables: 'Requirements analysis, software design, development, testing, support',
        priceRange: 'Custom quote'
    },
    {
        id: 'svc-007',
        name: 'Web Design, Hosting & Training',
        slug: 'web-hosting-training',
        category: 'Training & Web',
        summary: 'Web page design, domain registration, hosting and corporate ICT training packages.',
        description: 'We design and host websites, register domains, and deliver ICT training — from introductory computing and Microsoft Office to operating systems, networking and professional certification paths (MCP, MCSE, MCSE/MCSA, ethical hacking and network security). Special training packages are available for teachers and students.',
        icon: 'graduation-cap',
        features: ['Web page design & domain registration', 'Hosting services', 'Corporate & institutional ICT training', 'Professional certification paths'],
        deliverables: 'Website design, hosting setup, training curriculum & delivery',
        priceRange: 'Custom quote'
    },
    {
        id: 'svc-008',
        name: 'VPN, Video Conferencing & Bandwidth',
        slug: 'vpn-video-bandwidth',
        category: 'Connectivity',
        summary: 'VPN connectivity, video conferencing, bandwidth monitoring and dedicated internet access.',
        description: 'We implement VPNs using appliances such as SonicWall and Cisco, set up video conferencing in fixed and hospitality environments, and provide bandwidth monitoring & management, converged voice/data/video and dedicated internet access for businesses.',
        icon: 'network',
        features: ['VPN implementation (SonicWall, Cisco)', 'Video conferencing setup', 'Bandwidth monitoring & management', 'Dedicated internet access (DIA)'],
        deliverables: 'Network design, VPN & conferencing deployment, bandwidth reporting',
        priceRange: 'Custom quote'
    }
];

const initialPortfolio = [
    {
        id: 'pf-001',
        title: 'BusyInternet / ZipNet ISP — Network Redesign & Deployment',
        client: 'BusyInternet / Broadband Home Ltd',
        category: 'Telecommunications',
        description: 'Designed, installed and integrated IP networks; managed RF, NOC and project units; redesigned and upgraded the WiMAX network with high-performance Cisco routers and switches; deployed Alvarion WiMAX, billing server and public Wi-Fi hotspots, achieving near-ubiquitous coverage across Accra-Tema, Kumasi and Takoradi.',
        outcome: 'Internet backbone scaled from 8 Mbps on copper to 45 Mbps on fiber.'
    },
    {
        id: 'pf-002',
        title: 'GHL Bank / FNB Ghana — Core Network & Systems Automation',
        client: 'Ghana Home Loans / GHL Bank / FNB Ghana',
        category: 'Banking & Finance',
        description: 'Systems analysis and design of the core network topology, end-to-end implementation and configuration of branch-to-HQ and branch-to-branch connectivity, ATM connectivity, datacenter infrastructure (VM, servers, power), and print services support. Prior support covered racks, Windows servers, databases, firewall appliances (Smoothwall, Cyberoam) and Google Business Mail.',
        outcome: 'End-to-end bank network and systems automation delivered and supported.'
    },
    {
        id: 'pf-003',
        title: 'Bankswitch Ghana — Secure Document Management for Customs',
        client: 'Bankswitch Ghana Ltd (CEPS)',
        category: 'Government',
        description: 'Managed the design and deployment of the core network and all operational sites for the Ghana Customs Secure Document Management System, integrating CEPS, shipping lines and clearing agents. Managed clustered servers, SAN, Cisco routers, switches and ASAs, plus IT system audits across power, connectivity, backup compliance and disaster recovery.',
        outcome: 'National secure document management platform integrated across all stakeholders.'
    },
    {
        id: 'pf-004',
        title: 'eCard Debit Card Platform',
        client: 'DartCom Ltd',
        category: 'Banking & Finance',
        description: 'Managed multiple vendors to deploy a complex network of UHF base stations, Frame Relay backhaul, ATM WAN and debit card switch integration for Ecobank, Cal Bank, TTB and Bank of Ghana onto the eCard platform, including point-of-sale terminal deployment.',
        outcome: 'Multi-bank debit card switch integration delivered on the eCard platform.'
    },
    {
        id: 'pf-005',
        title: 'Eastern Corridor Fiber Optic Project',
        client: 'Alcatel-Lucent',
        category: 'Telecommunications',
        description: 'Served as in-country consultant to Alcatel-Lucent on the Eastern Corridor Fiber Optic Project spanning from Accra all the way to Bawku in the Upper East Region of Ghana.',
        outcome: 'Long-haul fiber corridor connecting the Eastern Corridor of Ghana.'
    },
    {
        id: 'pf-006',
        title: 'Corporate ICT Training & Civil Society Support',
        client: 'World Food Programme, UN, Council of State',
        category: 'Training & Support',
        description: 'Corporate training on ICT for the World Food Programme and the United Nations System Gender Programme, plus resident engineering services, systems support, software installations and mail server configuration for institutions including the Council of State and the Non-Formal Education Division.',
        outcome: 'Regarded as a leading provider of resident ICT support and corporate training in Ghana.'
    }
];

function buildInitialData() {
    const seedUsers = config.seedDemoData && !config.isProduction;
    return {
        services: initialServices,
        portfolio: initialPortfolio,
        inquiries: [],
        consultations: [],
        notifications: [],
        reports: [],
        auditLogs: [],
        workers: seedUsers
            ? [
                { id: 'WNS-001', name: 'Ama Boateng', department: 'Infrastructure', role: 'Network Engineer', email: 'ama.boateng@worldnetict.com', passwordHash: bcrypt.hashSync('worker123', 10), tempPassword: 'worker123' },
                { id: 'WNS-002', name: 'Kofi Mensah', department: 'Security', role: 'Security Analyst', email: 'kofi.mensah@worldnetict.com', passwordHash: bcrypt.hashSync('worker123', 10), tempPassword: 'worker123' },
                { id: 'WNS-003', name: 'Nadia Ali', department: 'Cloud', role: 'Solutions Architect', email: 'nadia.ali@worldnetict.com', passwordHash: bcrypt.hashSync('worker123', 10), tempPassword: 'worker123' }
            ]
            : [],
        admins: seedUsers
            ? [
                {
                    id: 'ADM-001',
                    name: 'System Admin',
                    email: 'admin@worldnetict.com',
                    passwordHash: bcrypt.hashSync('admin123', 10),
                    role: 'admin',
                    tempPassword: 'admin123'
                }
            ]
            : [],
        settings: {
            companyName: 'WorldNet ICT Solutions',
            contactEmail: 'info@worldnetictsolutions.com',
            contactPhone: '+233 55 344 6842'
        }
    };
}

let state = { ...buildInitialData() };
let saveQueue = Promise.resolve();
const recentSubmissions = new Map();

async function loadState() {
    try {
        state = await loadDatabase(buildInitialData(), { reset: process.env.NODE_ENV === 'test' });
        const pruned = pruneStoredFiles(state.reports);
        if (pruned > 0) logger.info(`Pruned ${pruned} expired report file(s).`);
    } catch (error) {
        logger.error('Database could not be initialized.', { error: error.message });
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

function createToken(payload) {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: `${config.tokenTtlHours}h` });
}

function sha256(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function makeResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

function nextSequentialId(list, prefix) {
    let max = 0;
    const re = new RegExp(`^${prefix}-(\\d+)$`);
    for (const item of list || []) {
        const match = item && item.id && String(item.id).match(re);
        if (match) max = Math.max(max, Number(match[1]));
    }
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

function generateTempPassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
    return `Wns@${code}`;
}

function toPublicWorker(worker) {
    if (!worker) return worker;
    const { passwordHash, ...publicWorker } = worker;
    return publicWorker;
}

function toPublicAdmin(admin) {
    if (!admin) return admin;
    const { passwordHash, ...publicAdmin } = admin;
    return publicAdmin;
}

function toPublicReport(report) {
    if (!report) return report;
    const { fileData, ...publicReport } = report;
    return publicReport;
}

function sanitizeProfilePhoto(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 800000) return '';
    if (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(trimmed)) return trimmed;
    return '';
}

const ACTIVE_REPORTS = () => state.reports.filter((report) => !report.deleted);

function normalizeDepartmentHeads() {
    const seen = new Set();
    for (const worker of state.workers) {
        if (!worker.isDepartmentHead) continue;
        if (seen.has(worker.department)) {
            worker.isDepartmentHead = false;
        } else {
            seen.add(worker.department);
        }
    }
}

function resolveAuth(req, _res, next) {
    const header = req.headers.authorization || '';
    const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    const cookies = parseCookies(req.headers.cookie);
    req.csrfToken = cookies[config.csrfCookieName] || '';
    if (bearerToken) {
        req.authVia = 'bearer';
        req.tokenSource = bearerToken;
    } else if (cookies[config.cookieName]) {
        req.authVia = 'cookie';
        req.tokenSource = cookies[config.cookieName];
    }
    if (req.tokenSource) {
        try {
            req.admin = jwt.verify(req.tokenSource, config.jwtSecret);
        } catch (error) {
            req.authError = 'invalid';
        }
    }
    next();
}

function authRequired(req, res, next) {
    if (req.authError) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    if (!req.admin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

function adminRequired(req, res, next) {
    if (!req.admin || req.admin.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    if (!state.admins.some((admin) => admin.id === req.admin.id)) {
        return res.status(403).json({ error: 'Your admin account is no longer active. Please contact IT support.' });
    }
    next();
}

function workerRequired(req, res, next) {
    if (!req.admin || req.admin.role !== 'worker') {
        return res.status(403).json({ error: 'Worker access required' });
    }
    if (!state.workers.some((worker) => worker.id === req.admin.id)) {
        return res.status(403).json({ error: 'Your team account is no longer active. Please contact an administrator.' });
    }
    next();
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

function recordAudit(action, actor, actorId, targetType, targetId, details = {}) {
    state.auditLogs.unshift({
        id: `audit-${crypto.randomBytes(4).toString('hex')}`,
        action,
        actor: actor || '',
        actorId: actorId || '',
        targetType: targetType || '',
        targetId: targetId || '',
        details,
        createdAt: new Date().toISOString()
    });
    if (state.auditLogs.length > 5000) state.auditLogs.length = 5000;
}

function appendStatusHistory(item, status, by) {
    const history = Array.isArray(item.statusHistory) ? item.statusHistory : [];
    return {
        ...item,
        status,
        statusHistory: [...history, { status, at: new Date().toISOString(), by: by || 'system' }]
    };
}

function initStatusHistory(item, by) {
    return {
        ...item,
        statusHistory: [{ status: item.status || 'new', at: new Date().toISOString(), by: by || 'system' }]
    };
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
    recordAudit('service.create', req.admin.name, req.admin.id, 'service', service.id, { name: service.name });
    await saveState();
    res.status(201).json(service);
});

app.put('/api/services/:id', authRequired, async (req, res) => {
    const index = state.services.findIndex((service) => service.id === req.params.id || service.slug === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Service not found' });
    const updated = { ...state.services[index], ...req.body, id: state.services[index].id, slug: req.body.slug || state.services[index].slug };
    state.services[index] = updated;
    recordAudit('service.update', req.admin.name, req.admin.id, 'service', updated.id, { name: updated.name });
    await saveState();
    res.json(updated);
});

app.delete('/api/services/:id', authRequired, async (req, res) => {
    const index = state.services.findIndex((service) => service.id === req.params.id || service.slug === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Service not found' });
    state.services[index] = { ...state.services[index], deleted: true, deletedAt: new Date().toISOString() };
    recordAudit('service.delete', req.admin.name, req.admin.id, 'service', req.params.id);
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
    recordAudit('portfolio.create', req.admin.name, req.admin.id, 'portfolio', item.id, { title: item.title });
    await saveState();
    res.status(201).json(item);
});

app.delete('/api/portfolio/:id', authRequired, async (req, res) => {
    const index = state.portfolio.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Portfolio item not found' });
    state.portfolio.splice(index, 1);
    recordAudit('portfolio.delete', req.admin.name, req.admin.id, 'portfolio', req.params.id);
    await saveState();
    res.json({ ok: true });
});

app.get('/api/inquiries', authRequired, (_req, res) => res.json(state.inquiries));

app.post('/api/inquiries', formLimiter, async (req, res) => {
    const { name, company, email, phone, service_type, message } = req.body;
    const errors = validateFields(req.body, {
        name: { required: true, maxLength: 200 },
        email: { required: true, type: 'email', maxLength: 254 },
        phone: { required: true, type: 'phone', maxLength: 30 },
        service_type: { required: true, maxLength: 200 },
        message: { required: true, maxLength: 5000 }
    });
    if (errors.length) return res.status(400).json({ error: errors[0] });
    const submissionKey = `${email}:${phone}:${service_type}`.toLowerCase();
    if (duplicateCheck(submissionKey)) return res.status(409).json({ error: 'A similar request was submitted recently. Please wait a moment and try again.' });

    let inquiry = {
        id: `inq-${crypto.randomBytes(3).toString('hex')}`,
        name: validateName(name),
        company: validateText(company || '', 200),
        email: String(email).trim().toLowerCase(),
        phone: sanitizeText(phone),
        service_type: validateText(service_type),
        message: validateText(message, 5000),
        status: 'new',
        handledBy: '',
        handledAt: '',
        createdAt: new Date().toISOString()
    };
    inquiry = initStatusHistory(inquiry, 'client');
    state.inquiries.unshift(inquiry);
    createNotification('inquiry', inquiry, 'New inquiry received', `${inquiry.name} submitted a new request for ${inquiry.service_type}.`);
    recordAudit('inquiry.create', 'public', '', 'inquiry', inquiry.id, { email: inquiry.email });
    await saveState();
    await notifySubmission('inquiry', inquiry);
    res.status(201).json({ ok: true, inquiry });
});

app.put('/api/inquiries/:id', authRequired, async (req, res) => {
    const index = state.inquiries.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Inquiry not found' });
    const handledBy = req.admin?.name ? String(req.admin.name) : (req.body.handledBy || state.inquiries[index].handledBy || '');
    const handledAt = handledBy && !state.inquiries[index].handledBy ? new Date().toISOString() : (req.body.handledAt || state.inquiries[index].handledAt || '');
    if (req.body.status) {
        if (!validateStatus(req.body.status, 'inquiry')) return res.status(400).json({ error: 'Unsupported inquiry status.' });
        if (req.body.status !== state.inquiries[index].status && !canTransition(state.inquiries[index].status, req.body.status, 'inquiry')) {
            return res.status(400).json({ error: `Cannot change inquiry status from ${state.inquiries[index].status} to ${req.body.status}.` });
        }
    }
    const statusChanged = req.body.status && req.body.status !== state.inquiries[index].status;
    let next = {
        ...state.inquiries[index],
        ...req.body,
        handledBy,
        handledAt
    };
    if (statusChanged) next = appendStatusHistory(next, req.body.status, req.admin.name);
    state.inquiries[index] = next;
    recordAudit('inquiry.update', req.admin.name, req.admin.id, 'inquiry', state.inquiries[index].id, { status: state.inquiries[index].status });
    await saveState();
    res.json(state.inquiries[index]);
});

app.put('/api/inquiries/:id/withdraw', async (req, res) => {
    const index = state.inquiries.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Inquiry not found' });
    if (state.inquiries[index].status !== 'new' && !canTransition(state.inquiries[index].status, 'withdrawn', 'inquiry')) {
        return res.status(400).json({ error: 'This inquiry can no longer be withdrawn.' });
    }
    state.inquiries[index] = appendStatusHistory(state.inquiries[index], 'withdrawn', 'client');
    recordAudit('inquiry.withdraw', 'public', '', 'inquiry', state.inquiries[index].id);
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
    if (req.body.status) {
        if (!validateStatus(req.body.status, 'consultation')) return res.status(400).json({ error: 'Unsupported consultation status.' });
        if (req.body.status !== state.consultations[index].status && !canTransition(state.consultations[index].status, req.body.status, 'consultation')) {
            return res.status(400).json({ error: `Cannot change consultation status from ${state.consultations[index].status} to ${req.body.status}.` });
        }
    }
    const statusChanged = req.body.status && req.body.status !== state.consultations[index].status;
    let next = {
        ...state.consultations[index],
        ...req.body,
        assignedDepartment: req.body.assignedDepartment || state.consultations[index].assignedDepartment || '',
        assignedWorker: req.body.assignedWorker || state.consultations[index].assignedWorker || '',
        handledBy,
        handledAt
    };
    if (statusChanged) next = appendStatusHistory(next, req.body.status, req.admin.name);
    state.consultations[index] = next;
    recordAudit('consultation.update', req.admin.name, req.admin.id, 'consultation', state.consultations[index].id, { status: state.consultations[index].status });
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
    if (!canTransition(state.consultations[index].status, 'withdrawn', 'consultation')) {
        return res.status(400).json({ error: 'This consultation can no longer be withdrawn.' });
    }
    state.consultations[index] = appendStatusHistory(state.consultations[index], 'withdrawn', 'client');
    recordAudit('consultation.withdraw', 'public', '', 'consultation', state.consultations[index].id);
    await saveState();
    res.json(state.consultations[index]);
});

app.post('/api/consultations', formLimiter, async (req, res) => {
    const { name, company, email, phone, preferred_date, preferred_time, notes } = req.body;
    const errors = validateFields(req.body, {
        name: { required: true, maxLength: 200 },
        email: { required: true, type: 'email', maxLength: 254 },
        phone: { required: true, type: 'phone', maxLength: 30 },
        preferred_date: { required: true, type: 'date' },
        preferred_time: { required: true, type: 'time' }
    });
    if (errors.length) return res.status(400).json({ error: errors[0] });
    const submissionKey = `${email}:${phone}:${preferred_date}:${preferred_time}`.toLowerCase();
    if (duplicateCheck(submissionKey)) return res.status(409).json({ error: 'A similar consultation request was submitted recently.' });
    let consultation = {
        id: `con-${crypto.randomBytes(3).toString('hex')}`,
        name: validateName(name),
        company: validateText(company || '', 200),
        email: String(email).trim().toLowerCase(),
        phone: sanitizeText(phone),
        preferred_date: sanitizeText(preferred_date),
        preferred_time: sanitizeText(preferred_time),
        notes: validateText(notes || '', 5000),
        status: 'pending',
        assignedDepartment: '',
        assignedWorker: '',
        handledBy: '',
        handledAt: '',
        createdAt: new Date().toISOString()
    };
    consultation = initStatusHistory(consultation, 'client');
    state.consultations.unshift(consultation);
    createNotification('consultation', consultation, 'New consultation request', `${consultation.name} requested a consultation for ${consultation.preferred_date} at ${consultation.preferred_time}.`);
    recordAudit('consultation.create', 'public', '', 'consultation', consultation.id, { email: consultation.email });
    await saveState();
    await notifySubmission('consultation', consultation);
    res.status(201).json({ ok: true, consultation });
});

app.post('/api/appointments', formLimiter, async (req, res) => {
    const { name, company, email, phone, preferred_date, preferred_time, notes } = req.body;
    const errors = validateFields(req.body, {
        name: { required: true, maxLength: 200 },
        email: { required: true, type: 'email', maxLength: 254 },
        phone: { required: true, type: 'phone', maxLength: 30 },
        preferred_date: { required: true, type: 'future-date' },
        preferred_time: { required: true, type: 'time' }
    });
    if (errors.length) return res.status(400).json({ error: errors[0] });

    let appointment = {
        id: `apt-${crypto.randomBytes(3).toString('hex')}`,
        name: validateName(name),
        company: validateText(company || '', 200),
        email: String(email).trim().toLowerCase(),
        phone: sanitizeText(phone),
        preferred_date: sanitizeText(preferred_date),
        preferred_time: sanitizeText(preferred_time),
        notes: validateText(notes || '', 5000),
        status: 'pending',
        handledBy: '',
        handledAt: '',
        createdAt: new Date().toISOString()
    };
    appointment = initStatusHistory(appointment, 'client');
    state.consultations.unshift(appointment);
    createNotification('consultation', appointment, 'New appointment request', `${appointment.name} requested an appointment for ${appointment.preferred_date} at ${appointment.preferred_time}.`);
    recordAudit('appointment.create', 'public', '', 'appointment', appointment.id, { email: appointment.email });
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
        notifications: state.notifications.filter((item) => !item.read).length,
        reports: ACTIVE_REPORTS().length,
        unreadReports: ACTIVE_REPORTS().filter((item) => !item.read).length
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

app.get('/api/admin/audit-logs', authRequired, adminRequired, (req, res) => {
    const { limit, action } = req.query;
    let logs = state.auditLogs;
    if (action) logs = logs.filter((log) => log.action === String(action));
    logs = logs.slice(0, Math.min(Number(limit || 200), 500));
    res.json(logs);
});

app.get('/api/admin/reports', authRequired, adminRequired, (_req, res) => res.json(ACTIVE_REPORTS().map(toPublicReport)));

app.put('/api/admin/reports/:id/read', authRequired, adminRequired, async (req, res) => {
    const report = ACTIVE_REPORTS().find((item) => item.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    report.read = true;
    recordAudit('report.read', req.admin.name, req.admin.id, 'report', report.id);
    await saveState();
    res.json(toPublicReport(report));
});

app.put('/api/admin/reports/:id', authRequired, adminRequired, async (req, res) => {
    const index = state.reports.findIndex((item) => item.id === req.params.id && !item.deleted);
    if (index < 0) return res.status(404).json({ error: 'Report not found' });
    let report = state.reports[index];
    if (typeof req.body.read === 'boolean') report.read = req.body.read;
    if (typeof req.body.status === 'string') {
        if (!REPORT_STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Unsupported report status.' });
        const nextStatus = sanitizeText(req.body.status);
        if (nextStatus !== report.status) report = appendStatusHistory(report, nextStatus, req.admin.name);
        report.status = nextStatus;
    }
    state.reports[index] = report;
    recordAudit('report.update', req.admin.name, req.admin.id, 'report', report.id, { status: report.status, read: report.read });
    await saveState();
    res.json(toPublicReport(report));
});

app.delete('/api/admin/reports/:id', authRequired, adminRequired, async (req, res) => {
    const index = state.reports.findIndex((item) => item.id === req.params.id && !item.deleted);
    if (index < 0) return res.status(404).json({ error: 'Report not found' });
    const removed = state.reports[index];
    state.reports[index] = { ...removed, deleted: true, deletedAt: new Date().toISOString() };
    unlinkFile(removed.fileKey);
    recordAudit('report.delete', req.admin.name, req.admin.id, 'report', removed.id);
    await saveState();
    res.json({ ok: true, report: { id: removed.id, deleted: true } });
});

app.get('/api/admin/reports/:id/download', authRequired, adminRequired, (req, res) => {
    const report = ACTIVE_REPORTS().find((item) => item.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const buffer = readFileBuffer(report.fileKey);
    if (!buffer) return res.status(404).json({ error: 'The report file is no longer available.' });
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', report.fileType || 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${sanitizeFileName(report.fileName)}"`);
    res.send(buffer);
});

app.get('/api/worker/reports/:id/download', authRequired, workerRequired, (req, res) => {
    const report = ACTIVE_REPORTS().find((item) => item.id === req.params.id && item.workerId === req.admin.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const buffer = readFileBuffer(report.fileKey);
    if (!buffer) return res.status(404).json({ error: 'The report file is no longer available.' });
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', report.fileType || 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${sanitizeFileName(report.fileName)}"`);
    res.send(buffer);
});

app.get('/api/admin/users', authRequired, adminRequired, (_req, res) => {
    res.json(state.admins.map(toPublicAdmin));
});
app.get('/api/admin/workers', authRequired, adminRequired, (_req, res) => res.json(state.workers.map(toPublicWorker)));

app.post('/api/admin/users', authRequired, adminRequired, async (req, res) => {
    const name = sanitizeText(req.body.name);
    const email = String(req.body.email || '').trim().toLowerCase();
    const providedPassword = String(req.body.password || '');
    if (!name || !email || !providedPassword) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (String(providedPassword).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (state.admins.some((item) => item.email.toLowerCase() === email)) {
        return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    if (state.workers.some((worker) => worker.email && worker.email.toLowerCase() === email)) {
        return res.status(409).json({ error: 'A worker already uses this email.' });
    }
    const admin = {
        id: nextSequentialId(state.admins, 'ADM'),
        name,
        email,
        passwordHash: bcrypt.hashSync(providedPassword, 10),
        role: 'admin',
        tempPassword: providedPassword
    };
    state.admins.push(admin);
    recordAudit('admin.create', req.admin.name, req.admin.id, 'admin', admin.id, { email: admin.email });
    await saveState();
    res.status(201).json({ ok: true, admin: toPublicAdmin(admin) });
});

app.post('/api/admin/users/:id/reset-password', authRequired, adminRequired, async (req, res) => {
    const index = state.admins.findIndex((admin) => admin.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'User not found' });
    const tempPassword = generateTempPassword();
    state.admins[index].passwordHash = bcrypt.hashSync(tempPassword, 10);
    state.admins[index].tempPassword = tempPassword;
    recordAudit('admin.password_reset', req.admin.name, req.admin.id, 'admin', state.admins[index].id);
    await saveState();
    res.json({ ok: true, id: state.admins[index].id, password: tempPassword });
});

app.delete('/api/admin/users/:id', authRequired, adminRequired, async (req, res) => {
    const index = state.admins.findIndex((admin) => admin.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'User not found' });
    if (state.admins.length === 1 && req.params.id === state.admins[0].id) {
        return res.status(400).json({ error: 'The last admin account cannot be deleted.' });
    }
    const [removed] = state.admins.splice(index, 1);
    recordAudit('admin.delete', req.admin.name, req.admin.id, 'admin', removed.id, { email: removed.email });
    await saveState();
    res.json({ ok: true, admin: { id: removed.id, name: removed.name, email: removed.email } });
});

app.post('/api/admin/workers', authRequired, adminRequired, async (req, res) => {
    const name = sanitizeText(req.body.name);
    const department = sanitizeText(req.body.department);
    const role = sanitizeText(req.body.role);
    const email = String(req.body.email || '').trim().toLowerCase();
    const providedPassword = String(req.body.password || '');
    if (!name || !department || !role) {
        return res.status(400).json({ error: 'Name, department, and role are required.' });
    }
    if (state.workers.some((worker) => worker.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ error: 'A worker with that name already exists.' });
    }
    if (email && state.workers.some((worker) => worker.email && worker.email.toLowerCase() === email)) {
        return res.status(409).json({ error: 'A worker with that email already exists.' });
    }
    if (providedPassword && String(providedPassword).length < 6) {
        return res.status(400).json({ error: 'Worker password must be at least 6 characters.' });
    }
    const tempPassword = providedPassword || generateTempPassword();
    const worker = {
        id: nextSequentialId(state.workers, 'WNS'),
        name,
        department,
        role,
        email: email || '',
        passwordHash: bcrypt.hashSync(tempPassword, 10),
        tempPassword,
        isDepartmentHead: Boolean(req.body.isDepartmentHead)
    };
    state.workers.push(worker);
    normalizeDepartmentHeads();
    recordAudit('worker.create', req.admin.name, req.admin.id, 'worker', worker.id, { name: worker.name, department: worker.department });
    await saveState();
    res.status(201).json(toPublicWorker(worker));
});

app.post('/api/admin/workers/:id/reset-password', authRequired, adminRequired, async (req, res) => {
    const index = state.workers.findIndex((worker) => worker.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Worker not found' });
    const tempPassword = generateTempPassword();
    state.workers[index].passwordHash = bcrypt.hashSync(tempPassword, 10);
    state.workers[index].tempPassword = tempPassword;
    recordAudit('worker.password_reset', req.admin.name, req.admin.id, 'worker', state.workers[index].id);
    await saveState();
    res.json({ ok: true, id: state.workers[index].id, password: tempPassword });
});

app.put('/api/admin/workers/:id', authRequired, adminRequired, async (req, res) => {
    const index = state.workers.findIndex((worker) => worker.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Worker not found' });
    const existing = state.workers[index];
    const name = sanitizeText(req.body.name) || existing.name;
    const department = sanitizeText(req.body.department) || existing.department;
    const role = sanitizeText(req.body.role) || existing.role;
    const email = String(req.body.email ?? existing.email).trim().toLowerCase();
    if (state.workers.some((worker) => worker.id !== existing.id && worker.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ error: 'A worker with that name already exists.' });
    }
    if (email && state.workers.some((worker) => worker.id !== existing.id && worker.email && worker.email.toLowerCase() === email)) {
        return res.status(409).json({ error: 'A worker with that email already exists.' });
    }
    if (email && req.body.password && String(req.body.password).length < 6) {
        return res.status(400).json({ error: 'Worker password must be at least 6 characters.' });
    }
    state.workers[index] = {
        ...existing,
        name,
        department,
        role,
        email,
        passwordHash: req.body.password ? bcrypt.hashSync(String(req.body.password), 10) : existing.passwordHash,
        tempPassword: req.body.password ? String(req.body.password) : existing.tempPassword,
        isDepartmentHead: typeof req.body.isDepartmentHead === 'boolean' ? req.body.isDepartmentHead : Boolean(existing.isDepartmentHead)
    };
    normalizeDepartmentHeads();
    state.consultations = state.consultations.map((consultation) => {
        if (consultation.assignedWorker === existing.name) {
            return { ...consultation, assignedWorker: name };
        }
        return consultation;
    });
    recordAudit('worker.update', req.admin.name, req.admin.id, 'worker', state.workers[index].id, { name: state.workers[index].name });
    await saveState();
    res.json(toPublicWorker(state.workers[index]));
});

app.get('/api/admin/departments', authRequired, adminRequired, (_req, res) => {
    const departments = {};
    for (const worker of state.workers) {
        const key = worker.department || 'Unassigned';
        if (!departments[key]) {
            departments[key] = { department: key, head: null, workers: [], consultationCount: 0 };
        }
        if (worker.isDepartmentHead) {
            departments[key].head = { id: worker.id, name: worker.name };
        }
        departments[key].workers.push({ id: worker.id, name: worker.name, role: worker.role, email: worker.email || '', isDepartmentHead: Boolean(worker.isDepartmentHead) });
    }
    for (const consultation of state.consultations) {
        const key = consultation.assignedDepartment || 'Unassigned';
        if (departments[key]) departments[key].consultationCount += 1;
    }
    res.json(Object.values(departments));
});

app.delete('/api/admin/workers/:id', authRequired, adminRequired, async (req, res) => {
    const index = state.workers.findIndex((worker) => worker.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Worker not found' });
    const [worker] = state.workers.splice(index, 1);
    normalizeDepartmentHeads();
    state.consultations = state.consultations.map((consultation) => (
        consultation.assignedWorker === worker.name
            ? { ...consultation, assignedWorker: '' }
            : consultation
    ));
    recordAudit('worker.delete', req.admin.name, req.admin.id, 'worker', worker.id, { name: worker.name });
    await saveState();
    res.json({ ok: true, worker });
});

app.get('/api/admin/status', (_req, res) => {
    res.json({ ok: true, ready: state.admins.length > 0 });
});

app.post('/api/admin/first-setup', authLimiter, async (req, res) => {
    if (state.admins.length > 0) {
        return res.status(409).json({ error: 'The administrative account has already been created.' });
    }
    const name = sanitizeText(req.body.name);
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (state.workers.some((worker) => worker.email && worker.email.toLowerCase() === email)) {
        return res.status(409).json({ error: 'This email is already used by a team member.' });
    }
    const admin = {
        id: nextSequentialId(state.admins, 'ADM'),
        name,
        email,
        passwordHash: bcrypt.hashSync(password, 10),
        role: 'admin'
    };
    state.admins.push(admin);
    recordAudit('admin.first_setup', admin.name, admin.id, 'admin', admin.id, { email: admin.email });
    await saveState();
    res.status(201).json({ ok: true, message: 'Administrator account created. You can now sign in.' });
});

app.post('/api/login', loginLimiter, async (req, res) => {
    const identifier = String(req.body.identifier ?? req.body.email ?? '').trim();
    const password = String(req.body.password ?? '');
    if (!identifier || !password) return res.status(400).json({ error: 'Staff ID or email and password are required.' });

    const findMatch = (list) => list.find((item) => {
        const idMatch = item.id && item.id.toLowerCase() === identifier.toLowerCase();
        const emailMatch = item.email && item.email.toLowerCase() === identifier.toLowerCase();
        return idMatch || emailMatch;
    });

    const admin = findMatch(state.admins);
    if (admin && admin.passwordHash && bcrypt.compareSync(password, admin.passwordHash)) {
        if (admin.tempPassword) {
            delete admin.tempPassword;
            await saveState();
        }
        const token = createToken({ id: admin.id, email: admin.email, name: admin.name, role: 'admin' });
        setSessionCookies(res, token);
        recordAudit('admin.login', admin.name, admin.id, 'admin', admin.id);
        await saveState();
        return res.json({ ok: true, role: 'admin', token, admin: { id: admin.id, name: admin.name, email: admin.email, profilePhoto: admin.profilePhoto || '' } });
    }

    const worker = findMatch(state.workers);
    if (worker && worker.passwordHash && bcrypt.compareSync(password, worker.passwordHash)) {
        if (worker.tempPassword) {
            delete worker.tempPassword;
            await saveState();
        }
        const token = createToken({ id: worker.id, email: worker.email, name: worker.name, role: 'worker' });
        setSessionCookies(res, token);
        recordAudit('worker.login', worker.name, worker.id, 'worker', worker.id);
        await saveState();
        return res.json({ ok: true, role: 'worker', token, worker: { id: worker.id, name: worker.name, email: worker.email, department: worker.department, role: worker.role, profilePhoto: worker.profilePhoto || '', isDepartmentHead: Boolean(worker.isDepartmentHead) } });
    }

    return res.status(401).json({ error: 'Invalid staff ID/email or password.' });
});

app.post('/api/logout', (_req, res) => {
    clearSessionCookies(res);
    res.json({ ok: true });
});

app.get('/api/me', authRequired, (req, res) => {
    const admin = state.admins.find((item) => item.id === req.admin.id);
    if (admin) {
        return res.json({ ok: true, role: 'admin', admin: toPublicAdmin(admin) });
    }
    const worker = state.workers.find((item) => item.id === req.admin.id);
    if (worker) {
        return res.json({ ok: true, role: 'worker', worker: toPublicWorker(worker) });
    }
    return res.status(404).json({ error: 'Account not found' });
});

app.get('/api/auth/config', (_req, res) => {
    res.json({
        allowRegistration: false,
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        needsSetup: state.admins.length === 0
    });
});

app.post('/api/register', authLimiter, (_req, res) => {
    res.status(403).json({ error: 'Self-registration is disabled. Ask an administrator to create your account.' });
});

app.post('/api/worker/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const worker = state.workers.find((item) => item.email && item.email.toLowerCase() === String(email).toLowerCase());
    if (!worker || !worker.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = bcrypt.compareSync(String(password), worker.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    if (worker.tempPassword) {
        delete worker.tempPassword;
        await saveState();
    }
    const token = createToken({ id: worker.id, email: worker.email, name: worker.name, role: 'worker' });
    setSessionCookies(res, token);
    recordAudit('worker.login', worker.name, worker.id, 'worker', worker.id);
    await saveState();
    res.json({ ok: true, token, worker: { id: worker.id, name: worker.name, email: worker.email, department: worker.department, role: worker.role, profilePhoto: worker.profilePhoto || '', isDepartmentHead: Boolean(worker.isDepartmentHead) } });
});

app.get('/api/worker/me', authRequired, workerRequired, (req, res) => {
    const worker = state.workers.find((item) => item.id === req.admin.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    const assignments = state.consultations.filter((consultation) => consultation.assignedWorker === worker.name);
    res.json({ worker: toPublicWorker(worker), assignments });
});

app.get('/api/worker/reports', authRequired, workerRequired, (req, res) => {
    res.json(state.reports.filter((report) => report.workerId === req.admin.id && !report.deleted).map(toPublicReport));
});

app.post('/api/worker/reports', authRequired, workerRequired, async (req, res) => {
    const worker = state.workers.find((item) => item.id === req.admin.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    const title = sanitizeText(req.body.title);
    if (!title) return res.status(400).json({ error: 'Report title is required.' });

    const isDraft = sanitizeText(req.body.status) === 'draft';
    let fileKey = '';
    let fileName = '';
    let fileSize = 0;
    const reportId = `rep-${crypto.randomBytes(3).toString('hex')}`;
    if (req.body.fileData) {
        const decoded = decodeDataUrl(req.body.fileData, 'application/pdf');
        if (!decoded.ok) return res.status(400).json({ error: 'Please attach a valid PDF file (max 8 MB).' });
        fileKey = fileKeyFor(reportId, '.pdf');
        storeFile(fileKey, decoded.buffer);
        fileName = sanitizeFileName(req.body.fileName);
        fileSize = decoded.buffer.length;
    } else if (!isDraft) {
        return res.status(400).json({ error: 'Please attach a valid PDF file (max 8 MB).' });
    }

    let report = {
        id: reportId,
        workerId: worker.id,
        workerName: worker.name,
        department: worker.department || '',
        title,
        notes: validateText(req.body.notes || '', 10000),
        fileName,
        fileType: 'application/pdf',
        fileKey,
        fileData: '',
        fileSize,
        status: isDraft ? 'draft' : 'new',
        read: false,
        submittedAt: new Date().toISOString(),
        deleted: false
    };
    report = initStatusHistory(report, worker.name);
    state.reports.unshift(report);
    if (!isDraft) {
        createNotification('report', report, 'New report submitted', `${worker.name} submitted a report: ${title}`);
        recordAudit('report.create', worker.name, worker.id, 'report', report.id, { title: report.title });
    } else {
        recordAudit('report.draft_saved', worker.name, worker.id, 'report', report.id, { title: report.title });
    }
    await saveState();
    const pruned = pruneStoredFiles(state.reports);
    if (pruned > 0) logger.info(`Pruned ${pruned} expired report file(s).`);
    res.status(201).json({ ok: true, report: toPublicReport(report) });
});

app.put('/api/worker/reports/:id', authRequired, workerRequired, async (req, res) => {
    const worker = state.workers.find((item) => item.id === req.admin.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    const index = state.reports.findIndex((item) => item.id === req.params.id && item.workerId === worker.id && !item.deleted);
    if (index < 0) return res.status(404).json({ error: 'Report not found' });
    const current = state.reports[index];
    if (current.status !== 'draft') {
        return res.status(403).json({ error: 'Only draft reports can be edited.' });
    }
    const title = req.body.title !== undefined ? sanitizeText(req.body.title) : current.title;
    if (!title) return res.status(400).json({ error: 'Report title is required.' });
    const notes = req.body.notes !== undefined ? validateText(req.body.notes || '', 10000) : current.notes;
    let fileKey = current.fileKey;
    let fileName = current.fileName;
    let fileSize = current.fileSize;
    let pastedData = '';
    if (req.body.fileData) {
        const decoded = decodeDataUrl(req.body.fileData, 'application/pdf');
        if (!decoded.ok) return res.status(400).json({ error: 'Please attach a valid PDF file (max 8 MB).' });
        const nextKey = fileKeyFor(current.id, '.pdf');
        storeFile(nextKey, decoded.buffer);
        if (fileKey && fileKey !== nextKey) unlinkFile(fileKey);
        fileKey = nextKey;
        fileName = sanitizeFileName(req.body.fileName) || current.fileName;
        fileSize = decoded.buffer.length;
    }
    const isSubmit = sanitizeText(req.body.status) === 'new';
    if (isSubmit && !current.fileKey && !req.body.fileData) {
        return res.status(400).json({ error: 'Attach a PDF file before submitting the report.' });
    }
    let report = {
        ...current,
        title,
        notes,
        fileKey,
        fileName,
        fileSize,
        fileData: pastedData,
        status: isSubmit ? 'new' : 'draft',
        submittedAt: isSubmit ? new Date().toISOString() : current.submittedAt
    };
    if (isSubmit && current.status !== 'new') report = appendStatusHistory(report, 'new', worker.name);
    state.reports[index] = report;
    if (isSubmit) {
        createNotification('report', report, 'New report submitted', `${worker.name} submitted a report: ${title}`);
        recordAudit('report.submit', worker.name, worker.id, 'report', report.id, { title: report.title });
    } else {
        recordAudit('report.draft_updated', worker.name, worker.id, 'report', report.id, { title: report.title });
    }
    await saveState();
    res.json({ ok: true, report: toPublicReport(report) });
});

app.get('/api/worker/department', authRequired, workerRequired, (req, res) => {
    const worker = state.workers.find((item) => item.id === req.admin.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    if (!worker.isDepartmentHead) {
        return res.status(403).json({ error: 'You are not a department head.' });
    }
    const members = state.workers.filter((item) => item.department === worker.department).map(toPublicWorker);
    const consultations = state.consultations.filter((item) => item.assignedDepartment === worker.department);
    const reports = state.reports.filter((item) => item.department === worker.department && !item.deleted).map(toPublicReport);
    res.json({ department: worker.department, workers: members, consultations, reports });
});

app.put('/api/worker/consultations/:id', authRequired, workerRequired, async (req, res) => {
    const worker = state.workers.find((item) => item.id === req.admin.id);
    if (!worker || !worker.isDepartmentHead) {
        return res.status(403).json({ error: 'Department head access required' });
    }
    const index = state.consultations.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Consultation not found' });
    const consultation = state.consultations[index];
    if (consultation.assignedDepartment !== worker.department) {
        return res.status(403).json({ error: 'This consultation is not assigned to your department.' });
    }
    const status = sanitizeText(req.body.status) || consultation.status;
    if (!CONSULTATION_STATUSES.includes(status)) return res.status(400).json({ error: 'Unsupported consultation status.' });
    if (status !== consultation.status && !canTransition(consultation.status, status, 'consultation')) {
        return res.status(400).json({ error: `Cannot change consultation status from ${consultation.status} to ${status}.` });
    }
    const handledBy = worker.name || consultation.handledBy;
    const handledAt = handledBy && !consultation.handledBy ? new Date().toISOString() : consultation.handledAt;
    let next = { ...consultation, status, handledBy, handledAt };
    if (status !== consultation.status) next = appendStatusHistory(next, status, worker.name);
    state.consultations[index] = next;
    recordAudit('worker.consultation.update', worker.name, worker.id, 'consultation', consultation.id, { status });
    await saveState();
    res.json(state.consultations[index]);
});

app.put('/api/profile', authRequired, async (req, res) => {
    const name = sanitizeText(req.body.name);
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    const profilePhoto = sanitizeProfilePhoto(req.body.profilePhoto);
    const isAdmin = req.admin.role === 'admin';
    const list = isAdmin ? state.admins : state.workers;
    const index = list.findIndex((item) => item.id === req.admin.id);
    if (index < 0) return res.status(404).json({ error: isAdmin ? 'Admin not found' : 'Worker not found' });
    const previousName = list[index].name;
    list[index].name = name;
    list[index].profilePhoto = profilePhoto;
    if (!isAdmin && previousName !== name) {
        state.consultations = state.consultations.map((consultation) => (
            consultation.assignedWorker === previousName ? { ...consultation, assignedWorker: name } : consultation
        ));
    }
    recordAudit(isAdmin ? 'admin.profile_update' : 'worker.profile_update', list[index].name, list[index].id, isAdmin ? 'admin' : 'worker', list[index].id);
    await saveState();
    return res.json(isAdmin ? toPublicAdmin(list[index]) : toPublicWorker(list[index]));
});

app.post('/api/forgot-password', authLimiter, async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const admin = state.admins.find((item) => item.email.toLowerCase() === normalizedEmail);
    if (!admin) return res.json({ ok: true, message: 'If an account exists for this email, a reset link has been sent.' });

    const token = makeResetToken();
    admin.resetTokenHash = sha256(token);
    admin.resetTokenExpires = Date.now() + 60 * 60 * 1000;
    await saveState();

    const resetUrl = `${process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`}/admin/reset-password.html?token=${token}`;
    const emailResult = await sendEmail({
        to: admin.email,
        subject: `${state.settings.companyName} — Reset your admin password`,
        text: `Hi ${admin.name},\n\nClick this link to reset your admin password (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Hi ${escapeHtml(admin.name)},</p><p>Click the button below to reset your admin password. The link expires in 1 hour.</p><p style="margin:1.2rem 0"><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:0.7rem 1.2rem;border-radius:0.6rem;text-decoration:none;font-weight:600">Reset password</a></p><p>If you did not request this, you can safely ignore this email.</p>`
    });

    const response = { ok: true, message: 'If an account exists for this email, a reset link has been sent.' };
    if (emailResult && emailResult.skipped) response.devResetLink = resetUrl;
    res.json(response);
});

app.post('/api/reset-password', authLimiter, async (req, res) => {
    const { token, password } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing reset token.' });
    if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const tokenHash = sha256(String(token));
    const admin = state.admins.find((item) => item.resetTokenHash && item.resetTokenHash === tokenHash);
    if (!admin) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    if (!admin.resetTokenExpires || Date.now() > admin.resetTokenExpires) {
        return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
    }
    admin.passwordHash = bcrypt.hashSync(String(password), 10);
    delete admin.resetTokenHash;
    delete admin.resetTokenExpires;
    delete admin.tempPassword;
    recordAudit('admin.password_reset', admin.name, admin.id, 'admin', admin.id);
    await saveState();
    res.json({ ok: true, message: 'Password updated. You can now sign in.' });
});

app.post('/api/auth/google', authLimiter, async (req, res) => {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential.' });
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });

    let payload;
    try {
        const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(credential))}`);
        if (!verifyResponse.ok) throw new Error('Google rejected the credential');
        payload = await verifyResponse.json();
    } catch (_error) {
        return res.status(401).json({ error: 'Google could not verify your sign-in. Please try again.' });
    }
    if (payload.aud !== clientId) return res.status(401).json({ error: 'The Google sign-in was issued for a different application.' });

    const googleEmail = String(payload.email || '').trim().toLowerCase();
    if (!googleEmail || payload.email_verified !== 'true') {
        return res.status(401).json({ error: 'Your Google account email is not verified.' });
    }

    let admin = state.admins.find((item) => item.email.toLowerCase() === googleEmail);
    if (!admin) {
        admin = {
            id: `adm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            name: payload.name || googleEmail.split('@')[0],
            email: googleEmail,
            passwordHash: bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10),
            role: 'admin',
            provider: 'google'
        };
        state.admins.push(admin);
        await saveState();
    }
    const token = createToken({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
    setSessionCookies(res, token);
    recordAudit('admin.login', admin.name, admin.id, 'admin', admin.id, { provider: 'google' });
    await saveState();
    res.json({ ok: true, token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, profilePhoto: admin.profilePhoto || '' }, provider: 'google' });
});

app.get('/api/settings', (_req, res) => res.json(state.settings));

app.put('/api/settings', authRequired, async (req, res) => {
    const allowed = ['companyName', 'contactEmail', 'contactPhone'];
    const updates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = sanitizeText(req.body[key]);
    }
    state.settings = { ...state.settings, ...updates };
    recordAudit('settings.update', req.admin.name, req.admin.id, 'settings', 'application', updates);
    await saveState();
    res.json(state.settings);
});

app.get('/services/:id', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'service-details.html'));
});

app.get('/portfolio-details/:id', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'portfolio-details.html'));
});

app.get('/faq.html', (_req, res) => res.redirect(301, '/about.html'));
app.get('/worker-login.html', (_req, res) => res.redirect(301, '/admin/login.html'));

app.use(express.static(PUBLIC_DIR));

app.get('*', (_req, res) => {
    if (_req.accepts('html')) {
        res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
        return;
    }
    res.status(404).json({ error: 'Not found' });
});

async function startServer(port = config.port) {
    await loadState();
    return app.listen(port, () => logger.info(`WorldNet server running on http://localhost:${port}`));
}

if (process.env.NODE_ENV !== 'test') {
    startServer().catch((error) => {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    });
}

export { app, startServer, closeDatabase };