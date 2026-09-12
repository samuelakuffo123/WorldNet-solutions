import pg from 'pg';
import { newDb } from 'pg-mem';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const { Pool } = pg;

let pool;
let inMemoryDatabase;
let schemaInitialized = false;

const isMemMode = () => process.env.DATABASE_URL === 'pg-mem://worldnet-test';
const snapshotFile = () => process.env.DEMO_SNAPSHOT_PATH || path.join(os.tmpdir(), 'worldnet-demo', 'demo-state.json');

async function loadDemoSnapshot() {
    try {
        const raw = await readFile(snapshotFile(), 'utf8');
        return JSON.parse(raw);
    } catch (_error) {
        return null;
    }
}

async function writeDemoSnapshot(data) {
    try {
        await mkdir(path.dirname(snapshotFile()), { recursive: true });
        await writeFile(snapshotFile(), JSON.stringify(data, null, 2), 'utf8');
    } catch (_error) {
        // Demo persistence is best-effort; never fail a request because of it.
    }
}

function createPool() {
    if (pool) return pool;

    // Tests use a PostgreSQL-compatible database without requiring a running server.
    if (isMemMode()) {
        inMemoryDatabase = newDb({ autoCreateForeignKeyIndices: true });
        const adapter = inMemoryDatabase.adapters.createPg();
        pool = new adapter.Pool();
        return pool;
    }

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.');
    }

    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });
    return pool;
}

const schema = `
    CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        summary TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        features JSONB NOT NULL,
        deliverables TEXT NOT NULL,
        price_range TEXT NOT NULL,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        deleted_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS portfolio (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        client TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        outcome TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS inquiries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        service_type TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        handled_by TEXT NOT NULL DEFAULT '',
        handled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS consultations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        preferred_date TEXT NOT NULL,
        preferred_time TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        assigned_department TEXT NOT NULL DEFAULT '',
        assigned_worker TEXT NOT NULL DEFAULT '',
        handled_by TEXT NOT NULL DEFAULT '',
        handled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        worker_name TEXT NOT NULL,
        department TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL DEFAULT 'application/pdf',
        file_data TEXT NOT NULL DEFAULT '',
        file_key TEXT NOT NULL DEFAULT '',
        file_size INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'new',
        read BOOLEAN NOT NULL DEFAULT FALSE,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        deleted_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT '',
        actor_id TEXT NOT NULL DEFAULT '',
        target_type TEXT NOT NULL DEFAULT '',
        target_id TEXT NOT NULL DEFAULT '',
        details JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        related_id TEXT NOT NULL DEFAULT '',
        read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin'
    );
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON inquiries (created_at DESC);
    CREATE INDEX IF NOT EXISTS consultations_created_at_idx ON consultations (created_at DESC);
    ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS handled_by TEXT NOT NULL DEFAULT '';
    ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ;
    ALTER TABLE consultations ADD COLUMN IF NOT EXISTS handled_by TEXT NOT NULL DEFAULT '';
    ALTER TABLE consultations ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ;
    ALTER TABLE consultations ADD COLUMN IF NOT EXISTS assigned_department TEXT NOT NULL DEFAULT '';
    ALTER TABLE consultations ADD COLUMN IF NOT EXISTS assigned_worker TEXT NOT NULL DEFAULT '';
    ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE consultations ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS temp_password TEXT NOT NULL DEFAULT '';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS profile_photo TEXT NOT NULL DEFAULT '';
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS is_department_head BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS temp_password TEXT NOT NULL DEFAULT '';
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS profile_photo TEXT NOT NULL DEFAULT '';
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_key TEXT NOT NULL DEFAULT '';
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
`;

function fromRows(rows, settings) {
    return {
        services: rows.services.map((row) => ({
            id: row.id, name: row.name, slug: row.slug, category: row.category, summary: row.summary,
            description: row.description, icon: row.icon, features: row.features, deliverables: row.deliverables,
            priceRange: row.price_range, deleted: row.deleted, deletedAt: row.deleted_at?.toISOString()
        })),
        portfolio: rows.portfolio,
        inquiries: rows.inquiries.map((row) => ({
            ...row,
            createdAt: row.created_at.toISOString(),
            handledBy: row.handled_by || '',
            handledAt: row.handled_at?.toISOString() || '',
            statusHistory: row.status_history || []
        })),
        consultations: rows.consultations.map((row) => ({
            ...row,
            createdAt: row.created_at.toISOString(),
            assignedDepartment: row.assigned_department || '',
            assignedWorker: row.assigned_worker || '',
            handledBy: row.handled_by || '',
            handledAt: row.handled_at?.toISOString() || '',
            statusHistory: row.status_history || []
        })),
        workers: rows.workers.map((row) => ({ id: row.id, name: row.name, department: row.department, role: row.role, email: row.email || '', passwordHash: row.password_hash || '', tempPassword: row.temp_password || '', profilePhoto: row.profile_photo || '', isDepartmentHead: Boolean(row.is_department_head) })),
        reports: rows.reports.map((row) => ({
            id: row.id,
            workerId: row.worker_id,
            workerName: row.worker_name,
            department: row.department || '',
            title: row.title,
            notes: row.notes || '',
            fileName: row.file_name,
            fileType: row.file_type || 'application/pdf',
            fileData: row.file_data || '',
            fileKey: row.file_key || '',
            fileSize: row.file_size || 0,
            status: row.status || 'new',
            read: Boolean(row.read),
            submittedAt: row.submitted_at instanceof Date ? row.submitted_at.toISOString() : row.submitted_at,
            deleted: Boolean(row.deleted),
            deletedAt: row.deleted_at instanceof Date ? row.deleted_at.toISOString() : (row.deleted_at || ''),
            statusHistory: row.status_history || []
        })),
        auditLogs: (rows.audit_logs || []).map((row) => ({
            id: row.id,
            action: row.action,
            actor: row.actor || '',
            actorId: row.actor_id || '',
            targetType: row.target_type || '',
            targetId: row.target_id || '',
            details: typeof row.details === 'object' ? row.details : {},
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
        })),
        notifications: rows.notifications.map((row) => ({ id: row.id, type: row.type, title: row.title, message: row.message, relatedId: row.related_id, read: row.read, createdAt: row.created_at.toISOString() })),
        admins: rows.admins.map((row) => ({ id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash, role: row.role, tempPassword: row.temp_password || '', profilePhoto: row.profile_photo || '' })),
        settings
    };
}

export async function loadDatabase(seedData, { reset = false } = {}) {
    const client = await createPool().connect();
    try {
        await client.query('BEGIN');
        if (!schemaInitialized) {
            await client.query(schema);
            schemaInitialized = true;
        }
        if (reset) {
            await clearDatabase(client);
        }
        const existing = await client.query('SELECT COUNT(*)::int AS count FROM admins');
        if (existing.rows[0].count === 0) {
            let snapshot = null;
            if (isMemMode() && !reset && process.env.NODE_ENV !== 'test') {
                snapshot = await loadDemoSnapshot();
            }
            if (snapshot) {
                await replaceDatabase(client, snapshot);
            } else {
                await replaceDatabase(client, seedData);
            }
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
    return readDatabase();
}

export async function readDatabase() {
    const client = await createPool().connect();
    try {
        const services = await client.query('SELECT * FROM services ORDER BY id');
        const portfolio = await client.query('SELECT * FROM portfolio ORDER BY id');
        const inquiries = await client.query('SELECT * FROM inquiries ORDER BY created_at DESC');
        const consultations = await client.query('SELECT * FROM consultations ORDER BY created_at DESC');
        const workers = await client.query('SELECT * FROM workers ORDER BY id');
        const notifications = await client.query('SELECT * FROM notifications ORDER BY created_at DESC');
        const reports = await client.query('SELECT * FROM reports ORDER BY submitted_at DESC');
        const admins = await client.query('SELECT * FROM admins ORDER BY id');
        const auditLogs = await client.query('SELECT * FROM audit_logs ORDER BY created_at DESC');
        const settingRows = await client.query("SELECT value FROM settings WHERE key = 'application'");
        return fromRows({ services: services.rows, portfolio: portfolio.rows, inquiries: inquiries.rows, consultations: consultations.rows, workers: workers.rows, notifications: notifications.rows, reports: reports.rows, admins: admins.rows, audit_logs: auditLogs.rows }, settingRows.rows[0]?.value || {});
    } finally {
        client.release();
    }
}

export async function saveDatabase(data) {
    const client = await createPool().connect();
    try {
        await client.query('BEGIN');
        await replaceDatabase(client, data);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
    if (isMemMode() && process.env.NODE_ENV !== 'test') {
        await writeDemoSnapshot(structuredClone(data));
    }
}

async function replaceDatabase(client, data) {
    await clearDatabase(client);
    for (const item of data.services) {
        await client.query('INSERT INTO services (id, name, slug, category, summary, description, icon, features, deliverables, price_range, deleted, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [item.id, item.name, item.slug, item.category, item.summary, item.description, item.icon, JSON.stringify(item.features || []), item.deliverables, item.priceRange, Boolean(item.deleted), item.deletedAt || null]);
    }
    for (const item of data.portfolio) await client.query('INSERT INTO portfolio (id, title, client, category, description, outcome) VALUES ($1,$2,$3,$4,$5,$6)', [item.id, item.title, item.client, item.category, item.description || '', item.outcome || '']);
    for (const item of data.inquiries) await client.query('INSERT INTO inquiries (id, name, company, email, phone, service_type, message, status, handled_by, handled_at, status_history, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [item.id, item.name, item.company || '', item.email, item.phone, item.service_type, item.message, item.status, item.handledBy || '', item.handledAt || null, JSON.stringify(item.statusHistory || []), item.createdAt]);
    for (const item of data.consultations) await client.query('INSERT INTO consultations (id, name, company, email, phone, preferred_date, preferred_time, notes, status, assigned_department, assigned_worker, handled_by, handled_at, status_history, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)', [item.id, item.name, item.company || '', item.email, item.phone, item.preferred_date, item.preferred_time, item.notes || '', item.status, item.assignedDepartment || '', item.assignedWorker || '', item.handledBy || '', item.handledAt || null, JSON.stringify(item.statusHistory || []), item.createdAt]);
    for (const item of data.workers || []) await client.query('INSERT INTO workers (id, name, department, role, email, password_hash, temp_password, profile_photo, is_department_head) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [item.id, item.name, item.department, item.role || '', item.email || '', item.passwordHash || '', item.tempPassword || '', item.profilePhoto || '', Boolean(item.isDepartmentHead)]);
    for (const item of data.reports || []) await client.query('INSERT INTO reports (id, worker_id, worker_name, department, title, notes, file_name, file_type, file_data, file_key, file_size, status, read, status_history, submitted_at, deleted, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)', [item.id, item.workerId, item.workerName, item.department || '', item.title, item.notes || '', item.fileName, item.fileType || 'application/pdf', item.fileData || '', item.fileKey || '', Number(item.fileSize || 0), item.status || 'new', Boolean(item.read), JSON.stringify(item.statusHistory || []), item.submittedAt, Boolean(item.deleted), item.deletedAt || null]);
    for (const item of data.auditLogs || []) await client.query('INSERT INTO audit_logs (id, action, actor, actor_id, target_type, target_id, details, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [item.id, item.action, item.actor || '', item.actorId || '', item.targetType || '', item.targetId || '', JSON.stringify(item.details || {}), item.createdAt]);
    for (const item of data.notifications || []) await client.query('INSERT INTO notifications (id, type, title, message, related_id, read, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [item.id, item.type, item.title, item.message, item.relatedId || '', Boolean(item.read), item.createdAt]);
    for (const item of data.admins) await client.query('INSERT INTO admins (id, name, email, password_hash, role, temp_password, profile_photo) VALUES ($1,$2,$3,$4,$5,$6,$7)', [item.id, item.name, item.email, item.passwordHash, item.role, item.tempPassword || '', item.profilePhoto || '']);
    await client.query("INSERT INTO settings (key, value) VALUES ('application', $1)", [JSON.stringify(data.settings)]);
}

async function clearDatabase(client) {
    for (const table of ['services', 'portfolio', 'inquiries', 'consultations', 'workers', 'reports', 'notifications', 'admins', 'audit_logs', 'settings']) {
        await client.query(`DELETE FROM ${table}`);
    }
}

export async function closeDatabase() {
    if (pool) await pool.end();
    pool = undefined;
    inMemoryDatabase = undefined;
    schemaInitialized = false;
}
