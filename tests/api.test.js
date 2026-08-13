import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'pg-mem://worldnet-test';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

async function startTestServer() {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'worldnet-test-'));
    const moduleUrl = pathToFileURL(path.join(workspaceRoot, 'src', 'server.js')).href;
    const serverModule = await import(moduleUrl);
    const server = await serverModule.startServer(0);

    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    return {
        baseUrl,
        async cleanup() {
            await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
            await serverModule.closeDatabase();
            await rm(tempDir, { recursive: true, force: true });
        }
    };
}

test('health endpoint responds successfully', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const response = await fetch(`${baseUrl}/api/health`);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.ok, true);
    } finally {
        await cleanup();
    }
});

test('appointment booking rejects past dates and saves future requests', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const pastDateResponse = await fetch(`${baseUrl}/api/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Ada',
                company: 'Northwind',
                email: 'ada@example.com',
                phone: '+233200000010',
                preferred_date: '2020-01-01',
                preferred_time: '09:00',
                notes: 'Past date should be rejected.'
            })
        });
        assert.equal(pastDateResponse.status, 400);
        const pastDateBody = await pastDateResponse.json();
        assert.match(pastDateBody.error, /future|date/i);

        const futureDateResponse = await fetch(`${baseUrl}/api/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Ada',
                company: 'Northwind',
                email: 'ada@example.com',
                phone: '+233200000010',
                preferred_date: '2099-01-01',
                preferred_time: '09:00',
                notes: 'Future date should be accepted.'
            })
        });
        assert.equal(futureDateResponse.status, 201);
        const futureDateBody = await futureDateResponse.json();
        assert.equal(futureDateBody.ok, true);
        assert.equal(futureDateBody.appointment.name, 'Ada');
    } finally {
        await cleanup();
    }
});

test('consultation requests can be tracked by email and phone', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const consultationResponse = await fetch(`${baseUrl}/api/consultations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Noah',
                company: 'Helix Labs',
                email: 'noah@example.com',
                phone: '+233200000002',
                preferred_date: '2026-08-20',
                preferred_time: '10:30'
            })
        });
        assert.equal(consultationResponse.status, 201);

        const trackResponse = await fetch(`${baseUrl}/api/consultations/track?email=noah@example.com&phone=%2B233200000002`);
        assert.equal(trackResponse.status, 200);
        const trackBody = await trackResponse.json();
        assert.equal(trackBody.consultation.status, 'pending');
        assert.equal(trackBody.consultation.name, 'Noah');
    } finally {
        await cleanup();
    }
});

test('consultation withdrawal requires the requester email and phone', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const createResponse = await fetch(`${baseUrl}/api/consultations`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Iris', email: 'iris@example.com', phone: '+233200000019', preferred_date: '2026-09-01', preferred_time: '10:00' })
        });
        const { consultation } = await createResponse.json();
        const deniedResponse = await fetch(`${baseUrl}/api/consultations/${consultation.id}/withdraw`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'other@example.com', phone: '+233200000019' })
        });
        assert.equal(deniedResponse.status, 403);
        const withdrawnResponse = await fetch(`${baseUrl}/api/consultations/${consultation.id}/withdraw`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'iris@example.com', phone: '+233200000019' })
        });
        assert.equal(withdrawnResponse.status, 200);
        assert.equal((await withdrawnResponse.json()).status, 'withdrawn');
    } finally {
        await cleanup();
    }
});

test('new consultations create an admin notification', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const loginResponse = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@worldnetict.com', password: 'admin123' })
        });
        assert.equal(loginResponse.status, 200);
        const loginBody = await loginResponse.json();
        const token = loginBody.token;

        const consultationResponse = await fetch(`${baseUrl}/api/consultations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Nia',
                company: 'Northwind',
                email: 'nia-notify@example.com',
                phone: '+233200000011',
                preferred_date: '2026-09-01',
                preferred_time: '11:00'
            })
        });
        assert.equal(consultationResponse.status, 201);

        const notificationsResponse = await fetch(`${baseUrl}/api/admin/notifications`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(notificationsResponse.status, 200);
        const notificationsBody = await notificationsResponse.json();
        assert.ok(notificationsBody.some((item) => item.title === 'New consultation request'));
    } finally {
        await cleanup();
    }
});

test('admin can assign consultations to a department and worker', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const loginResponse = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@worldnetict.com', password: 'admin123' })
        });
        assert.equal(loginResponse.status, 200);
        const loginBody = await loginResponse.json();
        const token = loginBody.token;

        const workersResponse = await fetch(`${baseUrl}/api/admin/workers`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(workersResponse.status, 200);
        const workersBody = await workersResponse.json();
        assert.ok(workersBody.length > 0);

        const consultationResponse = await fetch(`${baseUrl}/api/consultations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Mina',
                company: 'BluePeak',
                email: 'mina-assignment@example.com',
                phone: '+233200000009',
                preferred_date: '2026-08-14',
                preferred_time: '14:00'
            })
        });
        assert.equal(consultationResponse.status, 201);
        const consultationBody = await consultationResponse.json();
        const consultationId = consultationBody.consultation.id;

        const assignedConsultationResponse = await fetch(`${baseUrl}/api/consultations/${consultationId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: 'confirmed', assignedDepartment: 'Infrastructure', assignedWorker: workersBody[0].name })
        });
        assert.equal(assignedConsultationResponse.status, 200);
        const assignedConsultation = await assignedConsultationResponse.json();
        assert.equal(assignedConsultation.assignedDepartment, 'Infrastructure');
        assert.equal(assignedConsultation.assignedWorker, workersBody[0].name);
    } finally {
        await cleanup();
    }
});

test('admin can add and remove workers', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const loginResponse = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@worldnetict.com', password: 'admin123' })
        });
        const { token } = await loginResponse.json();
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
        const createResponse = await fetch(`${baseUrl}/api/admin/workers`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Kojo Asare', department: 'Cloud', role: 'Cloud Engineer' })
        });
        assert.equal(createResponse.status, 201);
        const worker = await createResponse.json();
        assert.equal(worker.name, 'Kojo Asare');

        const duplicateResponse = await fetch(`${baseUrl}/api/admin/workers`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'kojo asare', department: 'Cloud', role: 'Cloud Engineer' })
        });
        assert.equal(duplicateResponse.status, 409);

        const deleteResponse = await fetch(`${baseUrl}/api/admin/workers/${worker.id}`, { method: 'DELETE', headers });
        assert.equal(deleteResponse.status, 200);
        const workersResponse = await fetch(`${baseUrl}/api/admin/workers`, { headers });
        assert.ok(!(await workersResponse.json()).some((item) => item.id === worker.id));
    } finally {
        await cleanup();
    }
});

test('admin can update inquiry and consultation statuses', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const loginResponse = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@worldnetict.com', password: 'admin123' })
        });
        assert.equal(loginResponse.status, 200);
        const loginBody = await loginResponse.json();
        const token = loginBody.token;

        const inquiryResponse = await fetch(`${baseUrl}/api/inquiries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Ava',
                company: 'Northwind',
                email: 'ava@example.com',
                phone: '+233200000000',
                service_type: 'Cybersecurity',
                message: 'Need a security review.'
            })
        });
        assert.equal(inquiryResponse.status, 201);
        const inquiryBody = await inquiryResponse.json();
        const inquiryId = inquiryBody.inquiry.id;

        const updatedInquiryResponse = await fetch(`${baseUrl}/api/inquiries/${inquiryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: 'contacted' })
        });
        assert.equal(updatedInquiryResponse.status, 200);
        const updatedInquiry = await updatedInquiryResponse.json();
        assert.equal(updatedInquiry.status, 'contacted');

        const consultationResponse = await fetch(`${baseUrl}/api/consultations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Mina',
                company: 'BluePeak',
                email: 'mina@example.com',
                phone: '+233200000001',
                preferred_date: '2026-08-14',
                preferred_time: '14:00'
            })
        });
        assert.equal(consultationResponse.status, 201);
        const consultationBody = await consultationResponse.json();
        const consultationId = consultationBody.consultation.id;

        const updatedConsultationResponse = await fetch(`${baseUrl}/api/consultations/${consultationId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: 'confirmed' })
        });
        assert.equal(updatedConsultationResponse.status, 200);
        const updatedConsultation = await updatedConsultationResponse.json();
        assert.equal(updatedConsultation.status, 'confirmed');
    } finally {
        await cleanup();
    }
});

test('admin can create portfolio items and manage soft-deleted services', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const loginResponse = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@worldnetict.com', password: 'admin123' })
        });
        assert.equal(loginResponse.status, 200);
        const loginBody = await loginResponse.json();
        const token = loginBody.token;

        const portfolioResponse = await fetch(`${baseUrl}/api/portfolio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                title: 'Modern Data Center Rollout',
                client: 'TechFlow Ltd',
                category: 'Infrastructure',
                description: 'Delivered a high-availability data center refresh with secure cabling and redundant power.',
                outcome: 'Improved uptime and faster service provisioning.'
            })
        });
        assert.equal(portfolioResponse.status, 201);
        const portfolioBody = await portfolioResponse.json();
        assert.equal(portfolioBody.title, 'Modern Data Center Rollout');

        const createServiceResponse = await fetch(`${baseUrl}/api/services`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                name: 'Managed Wi-Fi Services',
                category: 'Connectivity',
                summary: 'End-to-end wireless network design and management for campuses.',
                description: 'Design, deploy, and support enterprise-grade wireless networks.',
                icon: 'wifi',
                features: ['Site survey', 'Design', 'Managed support'],
                deliverables: 'Survey report, deployment plan, ongoing service agreement',
                priceRange: 'Custom quote'
            })
        });
        assert.equal(createServiceResponse.status, 201);
        const createdService = await createServiceResponse.json();
        assert.equal(createdService.name, 'Managed Wi-Fi Services');

        const deleteServiceResponse = await fetch(`${baseUrl}/api/services/${createdService.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(deleteServiceResponse.status, 200);
        const deleteServiceBody = await deleteServiceResponse.json();
        assert.equal(deleteServiceBody.ok, true);

        const servicesResponse = await fetch(`${baseUrl}/api/services`);
        assert.equal(servicesResponse.status, 200);
        const servicesBody = await servicesResponse.json();
        assert.ok(!servicesBody.find((service) => service.id === createdService.id), 'Deleted service should not appear in active services');
    } finally {
        await cleanup();
    }
});
