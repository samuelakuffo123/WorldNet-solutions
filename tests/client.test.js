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
    const tempDir = await mkdtemp(path.join(tmpdir(), 'worldnet-client-test-'));
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

async function jsonFetch(url, options = {}) {
    const { headers = {}, ...rest } = options;
    const response = await fetch(url, { ...rest, headers: { 'Content-Type': 'application/json', ...headers } });
    const body = await response.json().catch(() => ({}));
    return { response, body };
}

const clientPayload = {
    fullName: 'Ama Owusu',
    email: 'ama.owusu@example.com',
    phone: '+233 55 123 4567',
    password: 'client-pass-123',
    companyName: 'Owusu Ventures'
};

test('clients can register, sign in, and read their profile', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const registered = await jsonFetch(`${baseUrl}/api/auth/register`, { method: 'POST', body: JSON.stringify(clientPayload) });
        assert.equal(registered.response.status, 201);
        assert.equal(registered.body.client.email, clientPayload.email);
        assert.ok(registered.body.token);

        const duplicate = await jsonFetch(`${baseUrl}/api/auth/register`, { method: 'POST', body: JSON.stringify(clientPayload) });
        assert.equal(duplicate.response.status, 409);

        const badPassword = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email: clientPayload.email, password: 'wrong-password' })
        });
        assert.equal(badPassword.response.status, 401);

        const loggedIn = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email: clientPayload.email, password: clientPayload.password })
        });
        assert.equal(loggedIn.response.status, 200);
        const token = loggedIn.body.token;
        assert.equal(loggedIn.body.client.fullName, clientPayload.fullName);

        const me = await jsonFetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(me.response.status, 200);
        assert.equal(me.body.role, 'client');
        assert.equal(me.body.client.id, registered.body.client.id);
    } finally {
        await cleanup();
    }
});

test('clients can update their profile and password', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const registered = await jsonFetch(`${baseUrl}/api/auth/register`, { method: 'POST', body: JSON.stringify(clientPayload) });
        const headers = { Authorization: `Bearer ${registered.body.token}` };

        const updated = await jsonFetch(`${baseUrl}/api/auth/profile`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ fullName: 'Ama Owusu II', phone: '+233 24 000 0101', companyName: 'Owusu Holdings' })
        });
        assert.equal(updated.response.status, 200);
        assert.equal(updated.body.client.fullName, 'Ama Owusu II');
        assert.equal(updated.body.client.companyName, 'Owusu Holdings');

        const wrongCurrent = await jsonFetch(`${baseUrl}/api/auth/password`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ currentPassword: 'nope-nope-nope', newPassword: 'brand-new-pass' })
        });
        assert.equal(wrongCurrent.response.status, 400);

        const changed = await jsonFetch(`${baseUrl}/api/auth/password`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ currentPassword: clientPayload.password, newPassword: 'brand-new-pass' })
        });
        assert.equal(changed.response.status, 200);

        const staleLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email: clientPayload.email, password: 'brand-new-pass' })
        });
        assert.equal(staleLogin.response.status, 200);
    } finally {
        await cleanup();
    }
});

test('consultation requests require client sign-in and land in the client dashboard', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const anonymous = await jsonFetch(`${baseUrl}/api/consultations`, {
            method: 'POST',
            body: JSON.stringify({ service_type: 'Cybersecurity', preferred_contact: 'email', notes: 'Hello?' })
        });
        assert.equal(anonymous.response.status, 401);

        const registered = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ ...clientPayload, email: 'eko@example.com', fullName: 'Ekow Mensah' })
        });
        const clientHeaders = { Authorization: `Bearer ${registered.body.token}` };

        const created = await jsonFetch(`${baseUrl}/api/consultations`, {
            method: 'POST',
            headers: clientHeaders,
            body: JSON.stringify({ service_type: 'Cloud Migration', preferred_contact: 'phone', preferred_timeframe: 'within_a_week', notes: 'Moving 40 users to the cloud.' })
        });
        assert.equal(created.response.status, 201);
        const consultation = created.body.consultation;
        assert.equal(consultation.name, 'Ekow Mensah');
        assert.equal(consultation.email, 'eko@example.com');
        assert.equal(consultation.serviceType, 'Cloud Migration');
        assert.equal(consultation.preferredContact, 'phone');
        assert.equal(consultation.status, 'pending');
        assert.equal(consultation.userId, registered.body.client.id);

        const dashboard = await jsonFetch(`${baseUrl}/api/auth/consultations`, { headers: clientHeaders });
        assert.equal(dashboard.response.status, 200);
        assert.equal(dashboard.body.consultations.length, 1);
        assert.equal(dashboard.body.consultations[0].id, consultation.id);
        assert.equal(dashboard.body.consultations[0].status, 'pending');

        const other = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ ...clientPayload, email: 'aria@example.com', fullName: 'Aria Wood' })
        });
        const otherDashboard = await jsonFetch(`${baseUrl}/api/auth/consultations`, {
            headers: { Authorization: `Bearer ${other.body.token}` }
        });
        assert.equal(otherDashboard.body.consultations.length, 0, 'clients only see their own requests');
    } finally {
        await cleanup();
    }
});

test('admin can move a client request through the pipeline and add notes the client can see', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const adminLogin = await jsonFetch(`${baseUrl}/api/login`, {
            method: 'POST',
            body: JSON.stringify({ email: 'admin@worldnetict.com', password: 'admin123' })
        });
        const adminHeaders = { Authorization: `Bearer ${adminLogin.body.token}` };

        const registered = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ ...clientPayload, email: 'kofi.client@example.com', fullName: 'Kofi Client' })
        });
        const clientHeaders = { Authorization: `Bearer ${registered.body.token}` };

        const created = await jsonFetch(`${baseUrl}/api/consultations`, {
            method: 'POST',
            headers: clientHeaders,
            body: JSON.stringify({ service_type: 'Data Centre', preferred_contact: 'email', notes: 'Site survey requested.' })
        });
        const consultationId = created.body.consultation.id;

        const contacted = await jsonFetch(`${baseUrl}/api/consultations/${consultationId}`, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ status: 'contacted', adminNotes: 'Spoke on Tuesday; sending a site survey.' })
        });
        assert.equal(contacted.response.status, 200);
        assert.equal(contacted.body.status, 'contacted');
        assert.equal(contacted.body.adminNotes, 'Spoke on Tuesday; sending a site survey.');

        const scheduled = await jsonFetch(`${baseUrl}/api/consultations/${consultationId}`, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ status: 'confirmed', assignedDepartment: 'Infrastructure' })
        });
        assert.equal(scheduled.response.status, 200);
        assert.equal(scheduled.body.status, 'confirmed');

        const completed = await jsonFetch(`${baseUrl}/api/consultations/${consultationId}`, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ status: 'completed' })
        });
        assert.equal(completed.response.status, 200);

        const closed = await jsonFetch(`${baseUrl}/api/consultations/${consultationId}`, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ status: 'closed' })
        });
        assert.equal(closed.response.status, 200);

        const dashboard = await jsonFetch(`${baseUrl}/api/auth/consultations`, { headers: clientHeaders });
        const item = dashboard.body.consultations[0];
        assert.equal(item.status, 'closed');
        assert.equal(item.adminNotes, 'Spoke on Tuesday; sending a site survey.');
        assert.deepEqual(item.statusHistory.map((entry) => entry.status), ['pending', 'contacted', 'confirmed', 'completed', 'closed']);
    } finally {
        await cleanup();
    }
});