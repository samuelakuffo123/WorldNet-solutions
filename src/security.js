import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from './config.js';

export function parseCookies(headerValue = '') {
    const cookies = {};
    for (const part of String(headerValue).split(';')) {
        const separator = part.indexOf('=');
        if (separator < 0) continue;
        cookies[part.slice(0, separator).trim()] = decodeURIComponent(part.slice(separator + 1).trim());
    }
    return cookies;
}

function cookieAttributes({ httpOnly = false, maxAge = undefined } = {}) {
    const attributes = ['Path=/', 'SameSite=Lax'];
    if (httpOnly) attributes.push('HttpOnly');
    if (config.secureCookies) attributes.push('Secure');
    if (maxAge !== undefined) attributes.push(`Max-Age=${maxAge}`);
    return attributes.join('; ');
}

export function setSessionCookies(res, payload) {
    res.setHeader('Set-Cookie', [
        `${config.cookieName}=${encodeURIComponent(payload)}; ${cookieAttributes({ httpOnly: true, maxAge: config.tokenTtlHours * 60 * 60 })}`,
        `${config.csrfCookieName}=${crypto.randomBytes(24).toString('base64url')}; ${cookieAttributes({ httpOnly: false, maxAge: config.tokenTtlHours * 60 * 60 })}`
    ]);
}

export function clearSessionCookies(res) {
    res.setHeader('Set-Cookie', [
        `${config.cookieName}=; Path=/; SameSite=Lax; Max-Age=0${config.secureCookies ? '; Secure' : ''}`,
        `${config.csrfCookieName}=; Path=/; SameSite=Lax; Max-Age=0${config.secureCookies ? '; Secure' : ''}`
    ]);
}

export function csrfProtect(req, res, next) {
    const method = String(req.method || 'GET').toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

    if (req.authVia === 'cookie') {
        const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'] || '';
        const cookieToken = req.csrfToken || '';
        if (!headerToken || !cookieToken || headerToken !== cookieToken) {
            return res.status(403).json({ error: 'CSRF token mismatch. Refresh the page and try again.' });
        }
    }
    next();
}

export function securityHeaders(req, res, next) {
    const csp = [
        "default-src 'self'",
        "script-src 'self' https://accounts.google.com https://www.google.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://images.unsplash.com",
        "font-src 'self'",
        "connect-src 'self' https://accounts.google.com",
        "worker-src 'self' blob:",
        "frame-src https://accounts.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
    ].join('; ');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', csp);
    if (config.secureCookies) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
}

export function sanitizeFileName(name, fallback = 'report.pdf') {
    const cleaned = String(name || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 120);
    const base = path.basename(cleaned);
    return base && path.extname(base).length ? base : fallback;
}

export function fileKeyFor(entityId, extension = '.pdf') {
    return `${entityId}-${crypto.randomBytes(4).toString('hex')}${extension}`;
}

function ensureUploadDir() {
    fs.mkdirSync(config.uploadDir, { recursive: true });
}

export function getAbsolutePath(key) {
    return path.join(config.uploadDir, path.basename(String(key || '')));
}

export function fileExists(key) {
    if (!key) return false;
    const absolutePath = getAbsolutePath(key);
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
}

export function storeFile(key, buffer) {
    ensureUploadDir();
    const absolutePath = getAbsolutePath(key);
    fs.writeFileSync(absolutePath, buffer);
    return key;
}

export function readFileBuffer(key) {
    if (!fileExists(key)) return null;
    try {
        return fs.readFileSync(getAbsolutePath(key));
    } catch {
        return null;
    }
}

export function unlinkFile(key) {
    if (!key) return;
    const absolutePath = getAbsolutePath(key);
    if (fs.existsSync(absolutePath)) {
        try {
            fs.unlinkSync(absolutePath);
        } catch {
            /* best-effort cleanup */
        }
    }
}

export function pruneStoredFiles(reports, retentionDays = config.reportRetentionDays) {
    if (!fs.existsSync(config.uploadDir)) return 0;
    const validKeys = new Set((reports || []).map((report) => report.fileKey || '').filter(Boolean));
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    try {
        for (const entry of fs.readdirSync(config.uploadDir, { withFileTypes: true })) {
            if (!entry.isFile() || validKeys.has(entry.name)) continue;
            const absolutePath = path.join(config.uploadDir, entry.name);
            try {
                if (fs.statSync(absolutePath).mtimeMs < cutoff) {
                    fs.unlinkSync(absolutePath);
                    removed += 1;
                }
            } catch {
                /* race with concurrent prune */
            }
        }
    } catch {
        /* defensive */
    }
    return removed;
}

export function decodeDataUrl(dataUrl, expectedType = 'application/pdf') {
    if (typeof dataUrl !== 'string') return { ok: false };
    const trimmed = dataUrl.trim();
    const prefix = `data:${expectedType};base64,`;
    if (!trimmed.startsWith(prefix)) return { ok: false };
    if (trimmed.length > config.reportMaxBytes * 1.5) return { ok: false };
    const base64 = trimmed.slice(prefix.length);
    if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) return { ok: false };
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer || buffer.length === 0 || buffer.length > config.reportMaxBytes) return { ok: false };
    if (expectedType === 'application/pdf' && !buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) return { ok: false };
    return { ok: true, buffer };
}