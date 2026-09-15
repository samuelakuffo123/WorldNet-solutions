import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'pg-mem://worldnet-test';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

const originalFetch = globalThis.fetch;

function stubTokenInfo({ email, sub, name = 'Google User', verified = 'true', aud = 'test-client.apps.googleusercontent.com', picture = 'https://lh3.googleusercontent.com/pic' }) {
    globalThis.fetch = (url, options) => {
        if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
            return Promise.resolve(new Response(JSON.stringify({ aud, email, email_verified: verified, name, sub, picture }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));
        }
        return originalFetch(url, options);
    };
}

function restoreFetch() {
    globalThis.fetch = originalFetch;
}

async function startTestServer() {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'worldnet-google-test-'));
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

test('google sign-in creates a verified client account and lets it request a consultation', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        stubTokenInfo({ email: 'gina.google@example.com', sub: 'google-sub-1', name: 'Gina Google' });
        const signedIn = await jsonFetch(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            body: JSON.stringify({ credential: 'token-1' })
        });
        assert.equal(signedIn.response.status, 200);
        assert.equal(signedIn.body.role, 'client');
        assert.equal(signedIn.body.created, true);
        assert.equal(signedIn.body.linked, false);
        assert.equal(signedIn.body.client.email, 'gina.google@example.com');
        assert.equal(signedIn.body.client.googleId, 'google-sub-1');
        assert.equal(signedIn.body.client.hasPassword, false);
        assert.equal(signedIn.body.client.fullName, 'Gina Google');
        const headers = { Authorization: `Bearer ${signedIn.body.token}` };

        const me = await jsonFetch(`${baseUrl}/api/me`, { headers });
        assert.equal(me.response.status, 200);
        assert.equal(me.body.role, 'client');
        assert.equal(me.body.client.googleId, 'google-sub-1');

        const created = await jsonFetch(`${baseUrl}/api/consultations`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ service_type: 'Cloud Migration', preferred_contact: 'email', notes: 'Signed in with Google.' })
        });
        assert.equal(created.response.status, 201);
        assert.equal(created.body.consultation.userId, signedIn.body.client.id);
        assert.equal(created.body.consultation.email, 'gina.google@example.com');
    } finally {
        restoreFetch();
        await cleanup();
    }
});

test('google sign-in links an existing email/password account without duplicating it', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const registered = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({
                fullName: 'Link Me',
                email: 'link.me@example.com',
                phone: '+233 20 000 0000',
                password: 'existing-pass-123'
            })
        });
        assert.equal(registered.response.status, 201);

        stubTokenInfo({ email: 'link.me@example.com', sub: 'google-sub-2', name: 'Link Me' });
        const signedIn = await jsonFetch(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            body: JSON.stringify({ credential: 'token-2' })
        });
        assert.equal(signedIn.response.status, 200);
        assert.equal(signedIn.body.created, false);
        assert.equal(signedIn.body.linked, true);
        assert.equal(signedIn.body.client.id, registered.body.client.id);
        assert.equal(signedIn.body.client.googleId, 'google-sub-2');
        assert.equal(signedIn.body.client.hasPassword, true);
    } finally {
        restoreFetch();
        await cleanup();
    }
});

test('google-only accounts cannot sign in with a password and cannot disconnect without one', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        stubTokenInfo({ email: 'only.google@example.com', sub: 'google-sub-3', name: 'Only Google' });
        const signedIn = await jsonFetch(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            body: JSON.stringify({ credential: 'token-3' })
        });
        const headers = { Authorization: `Bearer ${signedIn.body.token}` };

        const passwordLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email: 'only.google@example.com', password: 'anything-123' })
        });
        assert.equal(passwordLogin.response.status, 401);

        const disconnect = await jsonFetch(`${baseUrl}/api/auth/google/disconnect`, { method: 'POST', headers });
        assert.equal(disconnect.response.status, 400);
        assert.match(disconnect.body.error, /Set a password first/);
    } finally {
        restoreFetch();
        await cleanup();
    }
});

test('google-only users can set a password, then disconnect google safely', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        stubTokenInfo({ email: 'set.pw@example.com', sub: 'google-sub-4', name: 'Set Password' });
        const signedIn = await jsonFetch(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            body: JSON.stringify({ credential: 'token-4' })
        });
        const headers = { Authorization: `Bearer ${signedIn.body.token}` };

        const setPassword = await jsonFetch(`${baseUrl}/api/auth/password`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ newPassword: 'brand-new-pass' })
        });
        assert.equal(setPassword.response.status, 200);

        const passwordLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email: 'set.pw@example.com', password: 'brand-new-pass' })
        });
        assert.equal(passwordLogin.response.status, 200);

        const disconnect = await jsonFetch(`${baseUrl}/api/auth/google/disconnect`, { method: 'POST', headers });
        assert.equal(disconnect.response.status, 200);
        assert.equal(disconnect.body.client.googleId, '');

        stubTokenInfo({ email: 'set.pw@example.com', sub: 'google-sub-4', name: 'Set Password' });
        const relink = await jsonFetch(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            body: JSON.stringify({ credential: 'token-4' })
        });
        assert.equal(relink.response.status, 200);
        assert.equal(relink.body.linked, true);
        assert.equal(relink.body.client.googleId, 'google-sub-4');
    } finally {
        restoreFetch();
        await cleanup();
    }
});

test('a different google email creates a new account rather than merging', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        const registered = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({
                fullName: 'Other Person',
                email: 'oth.er@example.com',
                phone: '+233 20 111 1111',
                password: 'existing-pass-123'
            })
        });

        stubTokenInfo({ email: 'different@example.com', sub: 'google-sub-5', name: 'Different Person' });
        const signedIn = await jsonFetch(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            body: JSON.stringify({ credential: 'token-5' })
        });
        assert.equal(signedIn.response.status, 200);
        assert.equal(signedIn.body.created, true);
        assert.notEqual(signedIn.body.client.id, registered.body.client.id);
        assert.equal(signedIn.body.client.email, 'different@example.com');
    } finally {
        restoreFetch();
        await cleanup();
    }
});

test('google credentials issued for a different application are rejected', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        stubTokenInfo({ email: 'wrong.app@example.com', sub: 'google-sub-6', aud: 'some-other-client-id.apps.googleusercontent.com' });
        const signedIn = await jsonFetch(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            body: JSON.stringify({ credential: 'token-6' })
        });
        assert.equal(signedIn.response.status, 401);
    } finally {
        restoreFetch();
        await cleanup();
    }
});

test('google sign-in returns 503 when the server is not configured', async () => {
    const { baseUrl, cleanup } = await startTestServer();
    try {
        stubTokenInfo({ email: 'noconfig@example.com', sub: 'google-sub-7' });
        const previous = process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_ID;
        try {
            const signedIn = await jsonFetch(`${baseUrl}/api/auth/google`, {
                method: 'POST',
                body: JSON.stringify({ credential: 'token-7' })
            });
            assert.equal(signedIn.response.status, 503);
        } finally {
            process.env.GOOGLE_CLIENT_ID = previous;
        }
    } finally {
        restoreFetch();
        await cleanup();
    }
});