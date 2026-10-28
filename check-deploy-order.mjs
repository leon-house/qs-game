import fs from 'fs';
import path from 'path';

const dir = 'dist-release';
const files = [];
function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else files.push(full.replace(/\\/g, '/'));
    }
}
walk(dir);
files.sort();
console.log('First 15 files:');
for (let i = 0; i < 15; i++) console.log(i+1, files[i]);