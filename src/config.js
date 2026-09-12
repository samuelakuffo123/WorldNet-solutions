import path from 'path';
import os from 'os';
import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

function resolveSecret() {
    const secret = String(process.env.JWT_SECRET || '').trim();
    if (secret.length < 32) {
        const message = 'A strong JWT_SECRET (at least 32 characters) is required. Set it in your environment or .env file.';
        if (isProduction) throw new Error(message);
        console.warn(`[config] Insecure dev-only JWT_SECRET in use: ${message}`);
        return 'worldnet-dev-only-secret-do-not-use-in-production-0123456789abcdef';
    }
    return secret;
}

export function generateSecret() {
    return crypto.randomBytes(48).toString('base64url');
}

export const config = {
    isProduction,
    port: Number(process.env.PORT || 3000),
    jwtSecret: resolveSecret(),
    tokenTtlHours: Number(process.env.TOKEN_TTL_HOURS || 8),
    cookieName: 'wn_session',
    csrfCookieName: 'wn_csrf',
    corsOrigins: (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    secureCookies: isProduction || process.env.SECURE_COOKIES === 'true',
    uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'worldnet-uploads')),
    reportMaxBytes: Number(process.env.REPORT_MAX_BYTES || 8 * 1024 * 1024),
    reportRetentionDays: Number(process.env.REPORT_RETENTION_DAYS || 365),
    seedDemoData: process.env.SEED_DEMO_DATA !== 'false',
    publicBaseUrl: String(process.env.PUBLIC_BASE_URL || ''),
    logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'warn' : (isProduction ? 'info' : 'debug'))
};