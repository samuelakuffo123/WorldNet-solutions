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
        deliverables: 'Requirements analysis, software design, development, testing, training, support',
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

const initialData = {
    services: initialServices,
    portfolio: initialPortfolio,
    inquiries: [],
    consultations: [],
    notifications: [],
    workers: [
        { id: 'wrk-001', name: 'Ama Boateng', department: 'Infrastructure', role: 'Network Engineer', email: 'ama.boateng@worldnetict.com', passwordHash: bcrypt.hashSync('worker123', 10) },
        { id: 'wrk-002', name: 'Kofi Mensah', department: 'Security', role: 'Security Analyst', email: 'kofi.mensah@worldnetict.com', passwordHash: bcrypt.hashSync('worker123', 10) },
        { id: 'wrk-003', name: 'Nadia Ali', department: 'Cloud', role: 'Solutions Architect', email: 'nadia.ali@worldnetict.com', passwordHash: bcrypt.hashSync('worker123', 10) }
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
        contactEmail: 'info@worldnetictsolutions.com',
        contactPhone: '+233 55 344 6842'
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

function sha256(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function makeResetToken() {
    return crypto.randomBytes(32).toString('hex');
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

function adminRequired(req, res, next) {
    if (!req.admin || req.admin.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

function workerRequired(req, res, next) {
    if (!req.admin || req.admin.role !== 'worker') {
        return res.status(403).json({ error: 'Worker access required' });
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

app.get('/api/admin/users', authRequired, adminRequired, (_req, res) => res.json(state.admins));
app.get('/api/admin/workers', authRequired, adminRequired, (_req, res) => res.json(state.workers));

app.post('/api/admin/workers', authRequired, adminRequired, async (req, res) => {
    const name = sanitizeText(req.body.name);
    const department = sanitizeText(req.body.department);
    const role = sanitizeText(req.body.role);
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || !department || !role) {
        return res.status(400).json({ error: 'Name, department, and role are required.' });
    }
    if (state.workers.some((worker) => worker.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ error: 'A worker with that name already exists.' });
    }
    if (email && state.workers.some((worker) => worker.email && worker.email.toLowerCase() === email)) {
        return res.status(409).json({ error: 'A worker with that email already exists.' });
    }
    if (email && password && String(password).length < 6) {
        return res.status(400).json({ error: 'Worker password must be at least 6 characters.' });
    }
    const worker = {
        id: `wrk-${crypto.randomBytes(3).toString('hex')}`,
        name,
        department,
        role,
        email: email || '',
        passwordHash: email && password ? bcrypt.hashSync(String(password), 10) : ''
    };
    state.workers.push(worker);
    await saveState();
    res.status(201).json(worker);
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
        passwordHash: req.body.password ? bcrypt.hashSync(String(req.body.password), 10) : existing.passwordHash
    };
    state.consultations = state.consultations.map((consultation) => {
        if (consultation.assignedWorker === existing.name) {
            return { ...consultation, assignedWorker: name };
        }
        return consultation;
    });
    await saveState();
    res.json(state.workers[index]);
});

app.get('/api/admin/departments', authRequired, adminRequired, (_req, res) => {
    const departments = {};
    for (const worker of state.workers) {
        const key = worker.department || 'Unassigned';
        if (!departments[key]) {
            departments[key] = { department: key, workers: [], consultationCount: 0 };
        }
        departments[key].workers.push({ id: worker.id, name: worker.name, role: worker.role, email: worker.email || '' });
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

app.get('/api/auth/config', (_req, res) => {
    res.json({
        allowRegistration: true,
        googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
});

app.post('/api/register', authLimiter, async (req, res) => {
    const { name, email, password } = req.body;
    const missing = ['name', 'email', 'password'].filter((field) => !String(req.body[field] || '').trim());
    if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    if (!isValidEmail(String(email))) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = state.admins.some((item) => item.email.toLowerCase() === normalizedEmail);
    if (exists) return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
    const admin = {
        id: `adm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        name: sanitizeText(name),
        email: normalizedEmail,
        passwordHash: bcrypt.hashSync(String(password), 10),
        role: 'admin'
    };
    state.admins.push(admin);
    await saveState();
    const token = createToken({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
    res.status(201).json({ ok: true, token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
});

app.post('/api/worker/login', loginLimiter, (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const worker = state.workers.find((item) => item.email && item.email.toLowerCase() === String(email).toLowerCase());
    if (!worker || !worker.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = bcrypt.compareSync(String(password), worker.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = createToken({ id: worker.id, email: worker.email, name: worker.name, role: 'worker' });
    res.json({ ok: true, token, worker: { id: worker.id, name: worker.name, email: worker.email, department: worker.department, role: worker.role } });
});

app.get('/api/worker/me', authRequired, workerRequired, (req, res) => {
    const worker = state.workers.find((item) => item.id === req.admin.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    const assignments = state.consultations.filter((consultation) => consultation.assignedWorker === worker.name);
    res.json({ worker: { id: worker.id, name: worker.name, email: worker.email, department: worker.department, role: worker.role }, assignments });
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
    res.json({ ok: true, token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }, provider: 'google' });
});

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
