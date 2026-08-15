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

test('self-registration is disabled; unified login detects admin vs worker', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const registerResponse = await fetch(`${baseUrl}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'New Admin', email: 'new-admin@example.com', password: 's3cret-pass' })
        });
        assert.equal(registerResponse.status, 403);

        const configResponse = await fetch(`${baseUrl}/api/auth/config`);
        const config = await configResponse.json();
        assert.equal(config.allowRegistration, false);

        const adminLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'admin@worldnetict.com', password: 'admin123' })
        });
        assert.equal(adminLogin.status, 200);
        const adminBody = await adminLogin.json();
        assert.equal(adminBody.role, 'admin');
        assert.ok(adminBody.token);

        const workerEmailLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'ama.boateng@worldnetict.com', password: 'worker123' })
        });
        assert.equal(workerEmailLogin.status, 200);
        const workerEmailBody = await workerEmailLogin.json();
        assert.equal(workerEmailBody.role, 'worker');
        assert.equal(workerEmailBody.worker.name, 'Ama Boateng');

        const workerIdLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: workerEmailBody.worker.id, password: 'worker123' })
        });
        assert.equal(workerIdLogin.status, 200);
        const workerIdBody = await workerIdLogin.json();
        assert.equal(workerIdBody.role, 'worker');
        assert.equal(workerIdBody.worker.id, workerEmailBody.worker.id);

        const badLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'admin@worldnetict.com', password: 'wrong-pass' })
        });
        assert.equal(badLogin.status, 401);
    } finally {
        await cleanup();
    }
});

test('forgot password issues a reset token and reset-password updates it', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const forgotResponse = await fetch(`${baseUrl}/api/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@worldnetict.com' })
        });
        assert.equal(forgotResponse.status, 200);
        const forgotBody = await forgotResponse.json();
        assert.ok(forgotBody.devResetLink, 'SMTP is not configured in tests, so a dev reset link should be returned');
        const token = new URL(forgotBody.devResetLink).searchParams.get('token');
        assert.ok(token);

        const weakResetResponse = await fetch(`${baseUrl}/api/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password: 'short' })
        });
        assert.equal(weakResetResponse.status, 400);

        const resetResponse = await fetch(`${baseUrl}/api/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password: 'brand-new-pass' })
        });
        assert.equal(resetResponse.status, 200);

        const oldLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@worldnetict.com', password: 'admin123' })
        });
        assert.equal(oldLogin.status, 401);

        const newLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@worldnetict.com', password: 'brand-new-pass' })
        });
        assert.equal(newLogin.status, 200);
    } finally {
        await cleanup();
    }
});

test('unknown email for forgot password still returns ok', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const response = await fetch(`${baseUrl}/api/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nobody@example.com' })
        });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.ok, true);
    } finally {
        await cleanup();
    }
});

test('google auth rejects missing or invalid credentials', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const missingResponse = await fetch(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        assert.equal(missingResponse.status, 400);

        const notConfiguredResponse = await fetch(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: 'not-a-real-token' })
        });
        assert.equal(notConfiguredResponse.status, 503);
    } finally {
        await cleanup();
    }
});

test('auth config endpoint returns registration flag and google client id', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const response = await fetch(`${baseUrl}/api/auth/config`);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.allowRegistration, false);
        assert.ok('googleClientId' in body);
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

test('admin can create and remove system users', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const loginResponse = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'admin@worldnetict.com', password: 'admin123' })
        });
        const { token } = await loginResponse.json();
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

        const createResponse = await fetch(`${baseUrl}/api/admin/users`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Araba Quaye', email: 'araba.quaye@worldnetict.com', password: 'secure-pass-8' })
        });
        assert.equal(createResponse.status, 201);
        const created = await createResponse.json();
        assert.equal(created.admin.email, 'araba.quaye@worldnetict.com');

        const shortPasswordResponse = await fetch(`${baseUrl}/api/admin/users`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Short', email: 'short@worldnetict.com', password: '123' })
        });
        assert.equal(shortPasswordResponse.status, 400);

        const duplicateResponse = await fetch(`${baseUrl}/api/admin/users`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Araba Dup', email: 'araba.quaye@worldnetict.com', password: 'secure-pass-8' })
        });
        assert.equal(duplicateResponse.status, 409);

        const newUserLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'araba.quaye@worldnetict.com', password: 'secure-pass-8' })
        });
        assert.equal(newUserLogin.status, 200);
        const newUserBody = await newUserLogin.json();
        assert.equal(newUserBody.role, 'admin');

        const usersResponse = await fetch(`${baseUrl}/api/admin/users`, { headers });
        const users = await usersResponse.json();
        assert.ok(users.every((user) => !('passwordHash' in user)), 'user list must not leak password hashes');

        const deleteResponse = await fetch(`${baseUrl}/api/admin/users/${created.admin.id}`, { method: 'DELETE', headers });
        assert.equal(deleteResponse.status, 200);
        const removedLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'araba.quaye@worldnetict.com', password: 'secure-pass-8' })
        });
        assert.equal(removedLogin.status, 401);
    } finally {
        await cleanup();
    }
});

test('workers get sequential staff IDs and a viewable temporary password', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const loginResponse = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'ADM-001', password: 'admin123' })
        });
        const { token } = await loginResponse.json();
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

        const createResponse = await fetch(`${baseUrl}/api/admin/workers`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Yaa Owusu', department: 'Software', role: 'Developer' })
        });
        assert.equal(createResponse.status, 201);
        const worker = await createResponse.json();
        assert.equal(worker.id, 'WNS-004', 'new workers should get the next sequential staff ID');
        assert.ok(worker.tempPassword, 'a temporary password should be generated and viewable');
        assert.ok(!('passwordHash' in worker), 'worker responses must not expose password hashes');

        const listResponse = await fetch(`${baseUrl}/api/admin/workers`, { headers });
        const workers = await listResponse.json();
        assert.ok(workers.every((item) => !('passwordHash' in item)), 'worker list must not leak hashes');

        const loginWithTemp = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: worker.id, password: worker.tempPassword })
        });
        assert.equal(loginWithTemp.status, 200);
        const loginBody = await loginWithTemp.json();
        assert.equal(loginBody.role, 'worker');
        assert.equal(loginBody.worker.id, 'WNS-004');

        const listAfterLogin = await fetch(`${baseUrl}/api/admin/workers`, { headers });
        const afterLogin = await listAfterLogin.json();
        const yaa = afterLogin.find((item) => item.id === 'WNS-004');
        assert.ok(!yaa.tempPassword, 'temp password should be cleared after first sign-in');

        const resetResponse = await fetch(`${baseUrl}/api/admin/workers/${worker.id}/reset-password`, {
            method: 'POST',
            headers
        });
        assert.equal(resetResponse.status, 200);
        const resetBody = await resetResponse.json();
        assert.ok(resetBody.password);
        assert.notEqual(resetBody.password, worker.tempPassword);

        const loginAfterReset = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: worker.id, password: resetBody.password })
        });
        assert.equal(loginAfterReset.status, 200);
    } finally {
        await cleanup();
    }
});

test('admin-created users get sequential ADM IDs and reset-password works', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const loginResponse = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'ADM-001', password: 'admin123' })
        });
        const { token } = await loginResponse.json();
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

        const createResponse = await fetch(`${baseUrl}/api/admin/users`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Kwame Frimpong', email: 'kwame.frimpong@worldnetict.com', password: 'initial-pass-8' })
        });
        assert.equal(createResponse.status, 201);
        const created = await createResponse.json();
        assert.equal(created.admin.id, 'ADM-002', 'new admin users should get the next sequential staff ID');
        assert.equal(created.admin.tempPassword, 'initial-pass-8');

        const resetResponse = await fetch(`${baseUrl}/api/admin/users/${created.admin.id}/reset-password`, {
            method: 'POST',
            headers
        });
        assert.equal(resetResponse.status, 200);
        const resetBody = await resetResponse.json();
        assert.ok(resetBody.password);
        assert.ok(resetBody.password.length >= 8);

        const loginResponse2 = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: created.admin.id, password: resetBody.password })
        });
        assert.equal(loginResponse2.status, 200);
        assert.equal((await loginResponse2.json()).role, 'admin');
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

test('workers can sign in and view only their own assignments', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const adminLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@worldnetict.com', password: 'admin123' })
        });
        const { token } = await adminLogin.json();
        const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

        const workers = await (await fetch(`${baseUrl}/api/admin/workers`, { headers: adminHeaders })).json();
        const target = workers[0];

        const consultationResponse = await fetch(`${baseUrl}/api/consultations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Selina',
                company: 'Coastline',
                email: 'selina-worker@example.com',
                phone: '+233200000012',
                preferred_date: '2026-08-15',
                preferred_time: '10:00'
            })
        });
        const consultationBody = await consultationResponse.json();

        await fetch(`${baseUrl}/api/consultations/${consultationBody.consultation.id}`, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ assignedDepartment: target.department, assignedWorker: target.name })
        });

        const loginResponse = await fetch(`${baseUrl}/api/worker/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: target.email, password: 'worker123' })
        });
        assert.equal(loginResponse.status, 200);
        const loginBody = await loginResponse.json();
        assert.ok(loginBody.token);
        assert.equal(loginBody.worker.name, target.name);

        const meResponse = await fetch(`${baseUrl}/api/worker/me`, {
            headers: { Authorization: `Bearer ${loginBody.token}` }
        });
        assert.equal(meResponse.status, 200);
        const meBody = await meResponse.json();
        assert.equal(meBody.worker.id, target.id);
        assert.equal(meBody.worker.name, target.name);
        assert.ok(meBody.assignments.some((item) => item.id === consultationBody.consultation.id));

        const wrongPassword = await fetch(`${baseUrl}/api/worker/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: target.email, password: 'wrong-password' })
        });
        assert.equal(wrongPassword.status, 401);

        const workerHitsAdmin = await fetch(`${baseUrl}/api/admin/workers`, {
            headers: { Authorization: `Bearer ${loginBody.token}` }
        });
        assert.equal(workerHitsAdmin.status, 403);
    } finally {
        await cleanup();
    }
});

test('admin can create a worker with credentials and update their department and role', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const adminLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@worldnetict.com', password: 'admin123' })
        });
        const { token } = await adminLogin.json();
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

        const createResponse = await fetch(`${baseUrl}/api/admin/workers`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Efua Dadzie', department: 'Security', role: 'Penetration Tester', email: 'efua.dadzie@worldnetict.com', password: 'secure123' })
        });
        assert.equal(createResponse.status, 201);
        const worker = await createResponse.json();
        assert.equal(worker.email, 'efua.dadzie@worldnetict.com');

        const shortPassword = await fetch(`${baseUrl}/api/admin/workers`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Too Short', department: 'Security', role: 'Analyst', email: 'short@worldnetict.com', password: '123' })
        });
        assert.equal(shortPassword.status, 400);

        const updateResponse = await fetch(`${baseUrl}/api/admin/workers/${worker.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ department: 'Infrastructure', role: 'Network Engineer' })
        });
        assert.equal(updateResponse.status, 200);
        const updated = await updateResponse.json();
        assert.equal(updated.department, 'Infrastructure');
        assert.equal(updated.role, 'Network Engineer');

        const workerLogin = await fetch(`${baseUrl}/api/worker/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'efua.dadzie@worldnetict.com', password: 'secure123' })
        });
        assert.equal(workerLogin.status, 200);
    } finally {
        await cleanup();
    }
});

test('departments endpoint groups workers by department with their roles', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const adminLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@worldnetict.com', password: 'admin123' })
        });
        const { token } = await adminLogin.json();
        const headers = { Authorization: `Bearer ${token}` };

        const departmentsResponse = await fetch(`${baseUrl}/api/admin/departments`, { headers });
        assert.equal(departmentsResponse.status, 200);
        const departments = await departmentsResponse.json();
        assert.ok(departments.some((department) => department.department === 'Infrastructure'));
        const infrastructure = departments.find((department) => department.department === 'Infrastructure');
        assert.ok(infrastructure.workers.some((worker) => worker.name === 'Ama Boateng' && worker.role === 'Network Engineer'));

        const unauthenticated = await fetch(`${baseUrl}/api/admin/departments`);
        assert.equal(unauthenticated.status, 401);
    } finally {
        await cleanup();
    }
});
