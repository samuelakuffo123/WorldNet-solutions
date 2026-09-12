import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'pg-mem://worldnet-test';
process.env.SEED_DEMO_DATA = 'false';

function emptySeed() {
    return {
        services: [],
        portfolio: [],
        inquiries: [],
        consultations: [],
        workers: [],
        notifications: [],
        reports: [],
        admins: [],
        auditLogs: [],
        settings: { companyName: 'WorldNet ICT Solutions', contactEmail: 'info@worldnetictsolutions.com', contactPhone: '+233 55 344 6842' }
    };
}

test('demo state survives a restart via the snapshot file', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'worldnet-snap-'));
    process.env.DEMO_SNAPSHOT_PATH = path.join(tempDir, 'demo-state.json');
    process.env.UPLOAD_DIR = path.join(tempDir, 'uploads');

    try {
        const dbUrl = pathToFileURL(path.join(workspaceRoot, 'src', 'database.js')).href;
        const db = await import(dbUrl);

        let state = await db.loadDatabase(emptySeed());
        assert.equal(state.consultations.length, 0, 'starts empty');

        const consultation = {
            id: 'cns-0001',
            name: 'Nana Addo',
            company: 'Pulse Ltd',
            email: 'nana@example.com',
            phone: '+233244000099',
            preferred_date: '2026-12-01',
            preferred_time: '14:00',
            notes: 'Persist me.',
            status: 'pending',
            assignedDepartment: '',
            assignedWorker: '',
            handledBy: '',
            handledAt: null,
            statusHistory: [{ status: 'pending', by: 'client', at: new Date().toISOString() }],
            createdAt: new Date().toISOString()
        };
        state.consultations.push(consultation);
        await db.saveDatabase(state);
        await db.closeDatabase();

        const dbReloaded = await import(`${dbUrl}?restart=2`);
        state = await dbReloaded.loadDatabase(emptySeed());
        const persisted = state.consultations.find((item) => item.id === consultation.id);
        assert.ok(persisted, 'consultation persisted across the simulated restart');
        assert.equal(persisted.name, 'Nana Addo');
        assert.equal(persisted.status, 'pending');
        assert.equal(persisted.statusHistory.length, 1);
        await dbReloaded.closeDatabase();
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
});