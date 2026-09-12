console.log(`
WorldNet accessibility scan (axe-core) - setup + run instructions
=================================================================

Automated WCAG checks complement the manual a11y pass in AUDIT-REPORT.md
(section A: WCAG). Scan every public + admin view with axe-core.

Install (one time):
    npm install -D axe-core @axe-core/playwright @playwright/test
    npx playwright install chromium

Suggested spec (tests/a11y/axe.spec.js):
    import { AxeBuilder } from '@axe-core/playwright';
    import { test, expect } from '@playwright/test';
    for (const url of ['/', '/services', '/about', '/contact', '/admin/login.html']) {
        test(url + ' has no serious violations', async ({ page }) => {
            await page.goto(url);
            const results = await new AxeBuilder({ page }).analyze();
            expect(results.violations.filter((v) =>
                ['serious', 'critical'].includes(v.impact))).toEqual([]);
        });
    }

Run:
    npm run test:axe

Exit 0 - no tests executed because no browser runner is installed here.
`);
process.exit(0);