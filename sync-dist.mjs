import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const DST = path.join(ROOT, 'dist-release', 'src');
const INDEX_HTML = path.join(ROOT, 'index.html');
const DST_HTML = path.join(ROOT, 'dist-release', 'index.html');

function rmdir(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) rmdir(p); else fs.unlinkSync(p);
    }
    fs.rmdirSync(d);
}
function copyDir(s, d) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    for (const e of fs.readdirSync(s, { withFileTypes: true })) {
        const sp = path.join(s, e.name);
        const dp = path.join(d, e.name);
        if (e.isDirectory()) copyDir(sp, dp);
        else fs.copyFileSync(sp, dp);
    }
}

rmdir(DST);
copyDir(SRC, DST);
fs.copyFileSync(INDEX_HTML, DST_HTML);
console.log('Synced src → dist-release/src and index.html');
