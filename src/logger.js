import crypto from 'crypto';
import { config } from './config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const THRESHOLD = LEVELS[config.logLevel] ?? LEVELS.info;

function write(level, message, fields = {}) {
    if (LEVELS[level] < THRESHOLD) return;
    const line = JSON.stringify({
        ts: new Date().toISOString(),
        level,
        message,
        ...fields
    });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

export const logger = {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields)
};

export function requestLogger(req, res, next) {
    req.id = crypto.randomUUID();
    const startedAt = Date.now();
    res.on('finish', () => {
        write('info', `${req.method} ${req.originalUrl} -> ${res.statusCode}`, {
            requestId: req.id,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: Date.now() - startedAt
        });
    });
    next();
}