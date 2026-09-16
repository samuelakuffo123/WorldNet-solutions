import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'pg-mem://worldnet-test';
process.env.SEED_DEMO_DATA = 'false';
process.env.ADMIN_SETUP_TOKEN = 'test-setup-token';
process.env.UPLOAD_DIR = path.join(tmpdir(), `worldnet-uploads-firstsetup-${Date.now()}`);

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

test('a fresh database with seeds disabled uses the first-run setup to create the admin', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const status = await (await fetch(`${baseUrl}/api/admin/status`)).json();
        assert.equal(status.ready, false, 'a fresh production-like install has no admin yet');

        const config = await (await fetch(`${baseUrl}/api/auth/config`)).json();
        assert.equal(config.needsSetup, true);

        const register = await fetch(`${baseUrl}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Rogue', email: 'rogue@example.com', password: 'sup3r-secret' })
        });
        assert.equal(register.status, 403, 'self-registration stays disabled even before setup');

        const earlyLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'founder@worldnetict.com', password: 'whatever1' })
        });
        assert.equal(earlyLogin.status, 401, 'nobody can log in before setup');

        const weak = await fetch(`${baseUrl}/api/admin/first-setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Founder', email: 'founder@worldnetict.com', password: 'short', setupToken: 'test-setup-token' })
        });
        assert.equal(weak.status, 400, 'weak setup passwords are rejected');

        const badToken = await fetch(`${baseUrl}/api/admin/first-setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Rogue Admin', email: 'rogue@example.com', password: 'A-v3ry-S3cure-Pass', setupToken: 'wrong-token' })
        });
        assert.equal(badToken.status, 403, 'a wrong setup token cannot claim the admin slot');

        const created = await fetch(`${baseUrl}/api/admin/first-setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Founder Admin', email: 'founder@worldnetict.com', password: 'A-v3ry-S3cure-Pass', setupToken: 'test-setup-token' })
        });
        assert.equal(created.status, 201);

        const second = await fetch(`${baseUrl}/api/admin/first-setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Imposter', email: 'imposter@example.com', password: 'A-v3ry-S3cure-Pass', setupToken: 'test-setup-token' })
        });
        assert.equal(second.status, 403, 'setup closes permanently after the first admin exists');

        const configAfter = await (await fetch(`${baseUrl}/api/auth/config`)).json();
        assert.equal(configAfter.needsSetup, false);

        const statusAfter = await (await fetch(`${baseUrl}/api/admin/status`)).json();
        assert.equal(statusAfter.ready, true);

        const login = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'founder@worldnetict.com', password: 'A-v3ry-S3cure-Pass' })
        });
        assert.equal(login.status, 200);
        const loginBody = await login.json();
        assert.equal(loginBody.role, 'admin');
        assert.equal(loginBody.admin.name, 'Founder Admin');
    } finally {
        await cleanup();
    }
});