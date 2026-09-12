import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const ignoreDirs = new Set(['node_modules', '.git', 'css']);
const files = [];
function walk(dir) {
    for (const entry of readdirSync(dir)) {
        const absolute = path.join(dir, entry);
        if (statSync(absolute).isDirectory()) {
            if (ignoreDirs.has(entry) || entry.startsWith('.')) continue;
            walk(absolute);
        } else if (entry.endsWith('.js')) {
            files.push(absolute);
        }
    }
}
walk(root);

let failures = 0;
for (const file of files) {
    try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
        console.log(`ok - ${path.relative(root, file)}`);
    } catch (error) {
        failures += 1;
        console.error(`FAIL - ${path.relative(root, file)}`);
        console.error(String(error.stderr || error.message));
    }
}
if (failures > 0) {
    console.error(`${failures} file(s) failed the syntax check.`);
    process.exit(1);
}
console.log(`Syntax OK for ${files.length} JavaScript file(s).`);