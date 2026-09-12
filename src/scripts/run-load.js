console.log(`
WorldNet load test (k6) - setup + run instructions
===================================================

The API is hardened against flood abuse (express-rate-limit: 12 logins and
60 form submissions per 15/10 minutes per IP) and PDF uploads are capped at
8 MB (rate.limit + file size validation in validation.js). Run a small k6
smoke test against a deployed instance to confirm limits behave.

Install (one time): https://grafana.com/docs/k6/latest/set-up/install-k6/

Suggested script (tests/load/smoke.js):
    import http from 'k6/http';
    export const options = { vus: 5, duration: '10s' };
    export default function () {
        http.post('https://YOUR-APP/api/consultations', JSON.stringify({
            name: 'Load Test', company: 'k6', email: 'load@example.com',
            phone: '+233244000000', preferred_date: '2026-12-01',
            preferred_time: '09:00', notes: 'k6 smoke'
        }), { headers: { 'Content-Type': 'application/json' } });
    }

Run:
    k6 run tests/load/smoke.js

Exit 0 - no tests executed because k6 is not installed here.
`);
process.exit(0);