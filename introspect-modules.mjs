// introspect-modules.mjs
// 静态扫描 src/**/*.js，检查所有 import { X } 的 X 是否在被引用的文件里 export 过
import fs from 'fs';
import path from 'path';

function walk(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p, files);
        else if (p.endsWith('.js')) files.push(p);
    }
    return files;
}

const srcDir = process.argv[2] || 'src';
const files = walk(srcDir);
const exportMap = {};
const importMap = {};

for (const f of files) {
    let src = fs.readFileSync(f, 'utf8');
    src = src.replace(/\?v=[\w-]+/g, '');
    const base = path.relative(srcDir, f).replace(/\\/g, '/');

    // exports
    const expRe = /export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)/g;
    let m;
    while ((m = expRe.exec(src)) !== null) {
        if (!exportMap[base]) exportMap[base] = new Set();
        exportMap[base].add(m[1]);
    }
    // export { X, Y }
    const expListRe = /export\s*\{\s*([^}]+)\s*\}/g;
    while ((m = expListRe.exec(src)) !== null) {
        const items = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
        if (!exportMap[base]) exportMap[base] = new Set();
        items.forEach(x => x && exportMap[base].add(x));
    }

    // imports
    const impRe = /import\s+(?:\*\s+as\s+(\w+)|\{([^}]+)\})\s+from\s+['"]([^'"]+)['"]/g;
    while ((m = impRe.exec(src)) !== null) {
        const from = m[3];
        if (!from.startsWith('.')) continue;
        let names = [];
        if (m[1]) {
            names.push({ star: true, alias: m[1] });
        } else {
            names = m[2].split(',').map(s => s.trim()).filter(Boolean).map(s => {
                const parts = s.split(/\s+as\s+/);
                return { orig: parts[0].trim(), alias: parts[1] || parts[0].trim() };
            });
        }
        const fromPath = path.resolve(path.dirname(f), from);
        const fromRel = path.relative(srcDir, fromPath).replace(/\\/g, '/');
        if (!importMap[fromRel]) importMap[fromRel] = [];
        importMap[fromRel].push({ from: base, names });
    }
}

let missing = 0;
for (const from in importMap) {
    const exps = exportMap[from] || new Set();
    for (const { from: importer, names } of importMap[from]) {
        for (const n of names) {
            if (n.star) continue;
            if (!exps.has(n.orig)) {
                console.log(`MISSING: '${n.orig}' imported in ${importer} from ${from}`);
                missing++;
            }
        }
    }
}
console.log('---');
console.log(`Total files: ${files.length}`);
console.log(`Missing exports: ${missing}`);
