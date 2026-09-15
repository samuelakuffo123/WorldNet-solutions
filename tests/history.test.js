import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'pg-mem://worldnet-test';
process.env.SEED_DEMO_DATA = 'false';
process.env.UPLOAD_DIR = path.join(tmpdir(), `worldnet-uploads-history-${Date.now()}`);

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
    const { port } = server.address();
    return {
        baseUrl: `http://127.0.0.1:${port}`,
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

test('status changes are recorded in each entity status history', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        await jsonFetch(`${baseUrl}/api/admin/first-setup`, {
            method: 'POST',
            body: JSON.stringify({ name: 'Founder Deep', email: 'founder@worldnetict.com', password: 'A-v3ry-S3cure-Pass' })
        });

        const login = await jsonFetch(`${baseUrl}/api/login`, {
            method: 'POST',
            body: JSON.stringify({ identifier: 'founder@worldnetict.com', password: 'A-v3ry-S3cure-Pass' })
        });
        const token = login.body.token;
        const adminHeaders = { Authorization: `Bearer ${token}` };

        const createdConsultation = await jsonFetch(`${baseUrl}/api/consultations`, {
            method: 'POST',
            headers: adminHeaders,
            body: JSON.stringify({ name: 'Kofi Boateng', company: 'Adom Corp', email: 'kofi@example.com', phone: '+233244000001', service_type: 'Network Infrastructure', preferred_contact: 'email', preferred_date: '2026-11-20', preferred_time: '10:30', notes: 'Needs a site audit.' })
        });
        assert.equal(createdConsultation.response.status, 201);
        const consultationId = createdConsultation.body.consultation.id;
        assert.equal(createdConsultation.body.consultation.statusHistory.length, 1, 'consultations start with a creation entry');
        assert.equal(createdConsultation.body.consultation.statusHistory[0].status, 'pending');

        await jsonFetch(`${baseUrl}/api/consultations/${consultationId}`, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ status: 'confirmed' })
        });
        const consulted = await jsonFetch(`${baseUrl}/api/consultations/${consultationId}`, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ status: 'completed' })
        });
        const history = consulted.body.statusHistory || [];
        assert.equal(history.length, 3, 'each status change appends a history entry');
        assert.deepEqual(history.map((entry) => entry.status), ['pending', 'confirmed', 'completed']);
        assert.ok(history.every((entry) => entry.by), 'every entry records the actor');
        assert.ok(history.every((entry) => entry.at), 'every entry records the time');

        const createdInquiry = await jsonFetch(`${baseUrl}/api/inquiries`, {
            method: 'POST',
            body: JSON.stringify({ name: 'Ama Serwaa', email: 'ama@example.com', phone: '+233244000002', service_type: 'Cloud Migration', message: 'Please help us move to the cloud.' })
        });
        const inquiryId = createdInquiry.body.inquiry.id;
        assert.equal(createdInquiry.body.inquiry.statusHistory[0].status, 'new');

        const updatedInquiry = await jsonFetch(`${baseUrl}/api/inquiries/${inquiryId}`, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ status: 'contacted' })
        });
        assert.deepEqual(updatedInquiry.body.statusHistory.map((entry) => entry.status), ['new', 'contacted']);

        const report = {
            title: 'Monthly infra audit',
            notes: 'Summary of site uptime.',
            fileName: 'audit.pdf',
            fileData: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%%EOF').toString('base64')
        };
        const workerCreate = await jsonFetch(`${baseUrl}/api/admin/workers`, {
            method: 'POST',
            headers: adminHeaders,
            body: JSON.stringify({ name: 'Yaw Darko', email: 'yaw@example.com', password: 'staff-pass-123', department: 'Infrastructure', role: 'Field Engineer' })
        });
        const workerId = workerCreate.body.id;
        const workerLogin = await jsonFetch(`${baseUrl}/api/login`, {
            method: 'POST',
            body: JSON.stringify({ identifier: workerId, password: 'staff-pass-123' })
        });
        const workerHeaders = { Authorization: `Bearer ${workerLogin.body.token}` };

        const submitted = await jsonFetch(`${baseUrl}/api/worker/reports`, {
            method: 'POST',
            headers: { ...workerHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(report)
        });
        const reportId = submitted.body.report.id;
        assert.equal(submitted.body.report.statusHistory[0].status, 'new', 'reports start with a submission entry');

        const markedReport = await jsonFetch(`${baseUrl}/api/admin/reports/${reportId}`, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ status: 'approved' })
        });
        assert.deepEqual(markedReport.body.statusHistory.map((entry) => entry.status), ['new', 'approved']);
    } finally {
        await cleanup();
    }
});

test('report drafts stay quiet until submitted and can be edited', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        await jsonFetch(`${baseUrl}/api/admin/first-setup`, {
            method: 'POST',
            body: JSON.stringify({ name: 'Founder Deep', email: 'founder@worldnetict.com', password: 'A-v3ry-S3cure-Pass' })
        });
        const login = await jsonFetch(`${baseUrl}/api/login`, {
            method: 'POST',
            body: JSON.stringify({ identifier: 'founder@worldnetict.com', password: 'A-v3ry-S3cure-Pass' })
        });
        const adminHeaders = { Authorization: `Bearer ${login.body.token}` };

        const workerCreate = await jsonFetch(`${baseUrl}/api/admin/workers`, {
            method: 'POST',
            headers: adminHeaders,
            body: JSON.stringify({ name: 'Yaw Darko', email: 'yaw@example.com', password: 'staff-pass-123', department: 'Infrastructure', role: 'Field Engineer' })
        });
        const workerId = workerCreate.body.id;
        const workerLogin = await jsonFetch(`${baseUrl}/api/login`, {
            method: 'POST',
            body: JSON.stringify({ identifier: workerId, password: 'staff-pass-123' })
        });
        const workerHeaders = { Authorization: `Bearer ${workerLogin.body.token}` };

        const draft = await jsonFetch(`${baseUrl}/api/worker/reports`, {
            method: 'POST',
            headers: workerHeaders,
            body: JSON.stringify({ title: 'Draft site audit', notes: 'in progress', status: 'draft' })
        });
        assert.equal(draft.response.status, 201, 'fileless drafts are allowed');
        assert.equal(draft.body.report.status, 'draft');
        assert.equal(draft.body.report.fileKey, '');

        const adminList = await jsonFetch(`${baseUrl}/api/admin/reports`, { headers: adminHeaders });
        assert.ok(adminList.body.some((item) => item.id === draft.body.report.id), 'admin can see the draft');

        const finalize = await jsonFetch(`${baseUrl}/api/worker/reports/${draft.body.report.id}`, {
            method: 'PUT',
            headers: workerHeaders,
            body: JSON.stringify({
                title: 'Final site audit',
                notes: 'ready for review',
                status: 'draft',
                fileName: 'audit.pdf',
                fileData: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%%EOF').toString('base64')
            })
        });
        assert.equal(finalize.response.status, 200);
        assert.ok(finalize.body.report.fileSize > 0, 'file attached to the draft');

        const submitted = await jsonFetch(`${baseUrl}/api/worker/reports/${draft.body.report.id}`, {
            method: 'PUT',
            headers: workerHeaders,
            body: JSON.stringify({ title: 'Final site audit', notes: 'ready for review', status: 'new' })
        });
        assert.equal(submitted.response.status, 200);
        assert.equal(submitted.body.report.status, 'new');
        const history = submitted.body.report.statusHistory || [];
        assert.deepEqual(history.map((entry) => entry.status), ['draft', 'new'], 'submit appends to draft history');

        const locked = await jsonFetch(`${baseUrl}/api/worker/reports/${draft.body.report.id}`, {
            method: 'PUT',
            headers: workerHeaders,
            body: JSON.stringify({ title: 'Should fail', status: 'draft' })
        });
        assert.equal(locked.response.status, 403, 'submitted reports are locked');
    } finally {
        await cleanup();
    }
});