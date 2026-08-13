import pg from 'pg';
import { newDb } from 'pg-mem';

const { Pool } = pg;

let pool;
let inMemoryDatabase;
let schemaInitialized = false;

function createPool() {
    if (pool) return pool;

    // Tests use a PostgreSQL-compatible database without requiring a running server.
    if (process.env.DATABASE_URL === 'pg-mem://worldnet-test') {
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
        role TEXT NOT NULL DEFAULT ''
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
            handledAt: row.handled_at?.toISOString() || ''
        })),
        consultations: rows.consultations.map((row) => ({
            ...row,
            createdAt: row.created_at.toISOString(),
            assignedDepartment: row.assigned_department || '',
            assignedWorker: row.assigned_worker || '',
            handledBy: row.handled_by || '',
            handledAt: row.handled_at?.toISOString() || ''
        })),
        workers: rows.workers.map((row) => ({ id: row.id, name: row.name, department: row.department, role: row.role })),
        notifications: rows.notifications.map((row) => ({ id: row.id, type: row.type, title: row.title, message: row.message, relatedId: row.related_id, read: row.read, createdAt: row.created_at.toISOString() })),
        admins: rows.admins.map((row) => ({ id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash, role: row.role })),
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
        if (existing.rows[0].count === 0) await replaceDatabase(client, seedData);
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
        const admins = await client.query('SELECT * FROM admins ORDER BY id');
        const settingRows = await client.query("SELECT value FROM settings WHERE key = 'application'");
        return fromRows({ services: services.rows, portfolio: portfolio.rows, inquiries: inquiries.rows, consultations: consultations.rows, workers: workers.rows, notifications: notifications.rows, admins: admins.rows }, settingRows.rows[0]?.value || {});
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
}

async function replaceDatabase(client, data) {
    await clearDatabase(client);
    for (const item of data.services) {
        await client.query('INSERT INTO services (id, name, slug, category, summary, description, icon, features, deliverables, price_range, deleted, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [item.id, item.name, item.slug, item.category, item.summary, item.description, item.icon, JSON.stringify(item.features || []), item.deliverables, item.priceRange, Boolean(item.deleted), item.deletedAt || null]);
    }
    for (const item of data.portfolio) await client.query('INSERT INTO portfolio (id, title, client, category, description, outcome) VALUES ($1,$2,$3,$4,$5,$6)', [item.id, item.title, item.client, item.category, item.description || '', item.outcome || '']);
    for (const item of data.inquiries) await client.query('INSERT INTO inquiries (id, name, company, email, phone, service_type, message, status, handled_by, handled_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [item.id, item.name, item.company || '', item.email, item.phone, item.service_type, item.message, item.status, item.handledBy || '', item.handledAt || null, item.createdAt]);
    for (const item of data.consultations) await client.query('INSERT INTO consultations (id, name, company, email, phone, preferred_date, preferred_time, notes, status, assigned_department, assigned_worker, handled_by, handled_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', [item.id, item.name, item.company || '', item.email, item.phone, item.preferred_date, item.preferred_time, item.notes || '', item.status, item.assignedDepartment || '', item.assignedWorker || '', item.handledBy || '', item.handledAt || null, item.createdAt]);
    for (const item of data.workers || []) await client.query('INSERT INTO workers (id, name, department, role) VALUES ($1,$2,$3,$4)', [item.id, item.name, item.department, item.role || '']);
    for (const item of data.notifications || []) await client.query('INSERT INTO notifications (id, type, title, message, related_id, read, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [item.id, item.type, item.title, item.message, item.relatedId || '', Boolean(item.read), item.createdAt]);
    for (const item of data.admins) await client.query('INSERT INTO admins (id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)', [item.id, item.name, item.email, item.passwordHash, item.role]);
    await client.query("INSERT INTO settings (key, value) VALUES ('application', $1)", [JSON.stringify(data.settings)]);
}

async function clearDatabase(client) {
    for (const table of ['services', 'portfolio', 'inquiries', 'consultations', 'workers', 'notifications', 'admins', 'settings']) {
        await client.query(`DELETE FROM ${table}`);
    }
}

export async function closeDatabase() {
    if (pool) await pool.end();
    pool = undefined;
    inMemoryDatabase = undefined;
    schemaInitialized = false;
}
