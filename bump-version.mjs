// 统一入口版本号；src/** 内部 import 不带 query，避免 ESM 产生重复模块实例。
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Users/32545/WorkBuddy/2026-07-23-09-44-01';
const NEW = process.argv[2] || 'battle-render-stable-20260805a';
const ENTRY_FILES = [
    path.join(ROOT, 'index.html'),
    path.join(ROOT, 'dist-release', 'index.html'),
];

for (const file of ENTRY_FILES) {
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = before
        .replace(/\?v=[a-z0-9-]+/gi, `?v=${NEW}`)
        .replace(/\[VERSION\]\s*[a-z0-9-]+/gi, `[VERSION] ${NEW}`)
        .replace(/v=[a-z0-9-]+(?=<\/span>|<\/div>|">v=)/gi, `v=${NEW}`);
    if (after !== before) {
        fs.writeFileSync(file, after);
        console.log('updated', file);
    }
}

const badImports = [];
function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.name.endsWith('.js')) {
            const source = fs.readFileSync(file, 'utf8');
            if (/(?:from\s*|import\s*\()\s*['"][^'"]+\?v=/i.test(source)) badImports.push(file);
        }
    }
}
walk(path.join(ROOT, 'src'));
if (badImports.length) {
    console.error('发现 src 内部带 query 的 import（会造成重复 module instance）：');
    badImports.forEach(file => console.error('  -', file));
    process.exitCode = 1;
}
console.log(`Done. Version: ${NEW}; source import query violations: ${badImports.length}`);