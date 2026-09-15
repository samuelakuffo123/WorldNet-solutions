const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9()\-\s.]{7,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidEmail(value) {
    return EMAIL_RE.test(String(value || '').trim());
}

export function isValidPhone(value) {
    return PHONE_RE.test(String(value || '').trim());
}

export function isValidDateFormat(value) {
    return DATE_RE.test(String(value || '').trim()) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isValidTimeFormat(value) {
    return TIME_RE.test(String(value || '').trim());
}

export function isFutureOrTodayDate(value) {
    if (!isValidDateFormat(value)) return false;
    const selected = new Date(`${value}T00:00:00Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return selected >= today;
}

export function validateFields(body, rules) {
    const errors = [];
    for (const [field, rule] of Object.entries(rules || {})) {
        const value = body?.[field];
        if (rule.required && (value === undefined || String(value).trim() === '')) {
            errors.push(`${field} is required.`);
            continue;
        }
        if (value === undefined || value === null || String(value).trim() === '') continue;
        if (rule.type === 'email' && !isValidEmail(value)) errors.push(`Enter a valid email for ${field}.`);
        if (rule.type === 'phone' && !isValidPhone(value)) errors.push(`Enter a valid phone number for ${field}.`);
        if (rule.type === 'date' && !isValidDateFormat(value)) errors.push(`Enter a valid date for ${field}.`);
        if (rule.type === 'future-date' && !isFutureOrTodayDate(value)) errors.push(`Choose a date from today onward for ${field}.`);
        if (rule.type === 'time' && !isValidTimeFormat(value)) errors.push(`Enter a valid time for ${field}.`);
        if (rule.minLength && String(value).length < rule.minLength) errors.push(`${field} must be at least ${rule.minLength} characters.`);
        if (rule.maxLength && String(value).length > rule.maxLength) errors.push(`${field} must be at most ${rule.maxLength} characters.`);
        if (rule.oneOf && !rule.oneOf.includes(value)) errors.push(`${field} has an unsupported value.`);
    }
    return errors;
}

export const INQUIRY_STATUSES = ['new', 'contacted', 'in_review', 'resolved', 'closed', 'withdrawn'];
export const CONSULTATION_STATUSES = ['pending', 'contacted', 'confirmed', 'completed', 'cancelled', 'closed', 'withdrawn'];
export const REPORT_STATUSES = ['draft', 'new', 'under_review', 'approved', 'rejected', 'archived'];

const INQUIRY_TRANSITIONS = {
    new: ['contacted', 'in_review', 'resolved', 'withdrawn'],
    contacted: ['in_review', 'resolved', 'withdrawn'],
    in_review: ['contacted', 'resolved', 'withdrawn'],
    resolved: ['closed', 'withdrawn'],
    closed: [],
    withdrawn: []
};

const CONSULTATION_TRANSITIONS = {
    pending: ['contacted', 'confirmed', 'cancelled', 'withdrawn'],
    contacted: ['confirmed', 'completed', 'closed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    completed: ['closed', 'cancelled'],
    cancelled: ['pending'],
    closed: [],
    withdrawn: []
};

export function canTransition(currentStatus, nextStatus, kind = 'consultation') {
    const table = kind === 'inquiry' ? INQUIRY_TRANSITIONS : CONSULTATION_TRANSITIONS;
    const allowed = table[String(currentStatus || '')] || [];
    return allowed.includes(String(nextStatus || ''));
}

export function validateStatus(value, kind = 'consultation') {
    const list = kind === 'inquiry' ? INQUIRY_STATUSES : CONSULTATION_STATUSES;
    return list.includes(String(value || ''));
}

export function validateName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 200);
}

export function validateText(value, maxLength = 5000) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}