import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, utimes, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'pg-mem://worldnet-test';
process.env.UPLOAD_DIR = path.join(tmpdir(), `worldnet-uploads-${Date.now()}`);

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

function extractCookies(response) {
    const values = [];
    const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    for (const entry of setCookie.length ? setCookie : [response.headers.get('set-cookie') || '']) {
        values.push(entry.split(';')[0].trim());
    }
    return values.join('; ');
}

async function login(baseUrl, body) {
    const response = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    return { response, data, cookies: extractCookies(response) };
}

function csrfFromCookies(cookies) {
    const match = cookies.split(';').map((c) => c.trim()).find((c) => c.startsWith('wn_csrf='));
    if (!match) return '';
    return decodeURIComponent(match.split('=').slice(1).join('='));
}

test('login issues an HttpOnly session cookie and a readable CSRF cookie; cookie-authed requests work', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const { response, cookies } = await login(baseUrl, { identifier: 'admin@worldnetict.com', password: 'admin123' });
        assert.equal(response.status, 200);
        assert.match(cookies, /wn_session=/);
        assert.match(response.headers.get('set-cookie') || '', /HttpOnly/i);
        assert.match(cookies, /wn_csrf=/);

        const me = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: cookies } });
        assert.equal(me.status, 200);
        const meBody = await me.json();
        assert.equal(meBody.role, 'admin');
        assert.equal(meBody.admin.email, 'admin@worldnetict.com');

        const securityHeaders = await fetch(`${baseUrl}/api/health`);
        assert.match(securityHeaders.headers.get('content-security-policy') || '', /default-src 'self'/i);
        assert.equal(securityHeaders.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(securityHeaders.headers.get('x-frame-options'), 'DENY');
    } finally {
        await cleanup();
    }
});

test('cookie-authenticated mutations require a matching CSRF token; Bearer tokens do not', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const { data, cookies } = await login(baseUrl, { identifier: 'admin@worldnetict.com', password: 'admin123' });
        const csrf = csrfFromCookies(cookies);
        assert.ok(csrf, 'a CSRF cookie should be issued');

        const noToken = await fetch(`${baseUrl}/api/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: cookies },
            body: JSON.stringify({ name: 'Sneaky Admin' })
        });
        assert.equal(noToken.status, 403, 'cookie-authed mutation without CSRF header must be rejected');

        const wrongToken = await fetch(`${baseUrl}/api/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: cookies, 'X-CSRF-Token': 'forged' },
            body: JSON.stringify({ name: 'Sneaky Admin' })
        });
        assert.equal(wrongToken.status, 403);

        const withToken = await fetch(`${baseUrl}/api/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: cookies, 'X-CSRF-Token': csrf },
            body: JSON.stringify({ name: 'Verified Admin' })
        });
        assert.equal(withToken.status, 200);
        assert.equal((await withToken.json()).name, 'Verified Admin');

        const bearerUpdate = await fetch(`${baseUrl}/api/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
            body: JSON.stringify({ name: 'Bearer Admin' })
        });
        assert.equal(bearerUpdate.status, 200, 'Bearer-authenticated mutations should not require CSRF');
        assert.equal((await bearerUpdate.json()).name, 'Bearer Admin');
    } finally {
        await cleanup();
    }
});

test('admin mutating actions are written to the audit log and exposed via the audit API', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const { data } = await login(baseUrl, { identifier: 'admin@worldnetict.com', password: 'admin123' });
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` };

        const worker = await fetch(`${baseUrl}/api/admin/workers`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Audit Tester', department: 'Security', role: 'Analyst', email: 'audit@worldnetict.com', password: 'pass-1234' })
        });
        assert.equal(worker.status, 201);

        const logs = await (await fetch(`${baseUrl}/api/admin/audit-logs`, { headers })).json();
        assert.ok(logs.some((log) => log.action === 'worker.create'), 'worker.create should be audited');
        assert.ok(logs.some((log) => log.action === 'admin.login'), 'logins should be audited');

        const anon = await fetch(`${baseUrl}/api/admin/audit-logs`);
        assert.equal(anon.status, 401);
    } finally {
        await cleanup();
    }
});

test('reports are stored on disk, exposed without base64 fileData, downloadable, and purged on delete and retention', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    const uploadDir = process.env.UPLOAD_DIR;
    try {
        const adminLogin = await login(baseUrl, { identifier: 'admin@worldnetict.com', password: 'admin123' });
        const workerLogin = await login(baseUrl, { identifier: 'ama.boateng@worldnetict.com', password: 'worker123' });
        const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminLogin.data.token}` };
        const workerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${workerLogin.data.token}` };

        const pdf = Buffer.from('%PDF-1.4 cookie-secure report body');
        const submit = await fetch(`${baseUrl}/api/worker/reports`, {
            method: 'POST',
            headers: workerHeaders,
            body: JSON.stringify({ title: 'Secure Survey', fileName: 'secure.pdf', fileData: `data:application/pdf;base64,${pdf.toString('base64')}` })
        });
        assert.equal(submit.status, 201);
        const { report } = await submit.json();
        assert.ok(report.fileKey, 'stored reports should expose a fileKey');
        assert.equal(report.fileData, undefined, 'stored reports must not expose base64 fileData');

        const adminList = await (await fetch(`${baseUrl}/api/admin/reports`, { headers: adminHeaders })).json();
        const listed = adminList.find((item) => item.id === report.id);
        assert.ok(listed);
        assert.ok(!listed.fileData, 'report lists must not include fileData');

        const download = await fetch(`${baseUrl}/api/admin/reports/${report.id}/download`, { headers: adminHeaders });
        assert.equal(download.status, 200);
        assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);

        const workerDownload = await fetch(`${baseUrl}/api/worker/reports/${report.id}/download`, { headers: workerHeaders });
        assert.equal(workerDownload.status, 200);
        assert.deepEqual(Buffer.from(await workerDownload.arrayBuffer()), pdf);

        const anonDownload = await fetch(`${baseUrl}/api/admin/reports/${report.id}/download`);
        assert.equal(anonDownload.status, 401);

        const deleteReport = await fetch(`${baseUrl}/api/admin/reports/${report.id}`, { method: 'DELETE', headers: adminHeaders });
        assert.equal(deleteReport.status, 200);
        const afterDelete = await (await fetch(`${baseUrl}/api/admin/reports`, { headers: adminHeaders })).json();
        assert.ok(!afterDelete.some((item) => item.id === report.id), 'soft-deleted reports must disappear from lists');

        const stray = path.join(uploadDir, 'stale-report.pdf');
        await writeFile(stray, '%PDF stale');
        const old = new Date(Date.now() - 800 * 24 * 60 * 60 * 1000);
        await utimes(stray, old, old);

        const resubmit = await fetch(`${baseUrl}/api/worker/reports`, {
            method: 'POST',
            headers: workerHeaders,
            body: JSON.stringify({ title: 'Another Survey', fileName: 'another.pdf', fileData: `data:application/pdf;base64,${pdf.toString('base64')}` })
        });
        assert.equal(resubmit.status, 201);

        let missing = true;
        try {
            await access(stray);
            missing = false;
        } catch {
            missing = true;
        }
        assert.equal(missing, true, 'stale report files beyond retention should be pruned');
    } finally {
        await rm(uploadDir, { recursive: true, force: true }).catch(() => { });
        await cleanup();
    }
});