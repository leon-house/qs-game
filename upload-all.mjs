// sync-all.mjs - 同步所有 src/** + index.html + style.css 到服务器（用 readFile/writeFile 避免 fastPut bug）
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SERVER = { host: '106.54.31.70', port: 22, username: 'ubuntu', password: '8}iQ}3@r123' };
const REMOTE = '/home/ubuntu/Leon-game';
const ROOT = path.dirname(fileURLToPath(import.meta.url));

function collect(dir, base, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        const rel = path.relative(base, p).replace(/\\/g, '/');
        if (e.isDirectory()) collect(p, base, out);
        else out.push(rel);
    }
    return out;
}

const files = collect(path.join(ROOT, 'src'), path.join(ROOT, 'src'))
    .filter(f => !f.startsWith('wx-canvas2d/'))
    .map(f => 'src/' + f)
    .concat(['index.html', 'style.css']);

console.log(`准备上传 ${files.length} 个文件`);

const conn = new Client();
conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) { console.error(err); conn.end(); return; }
        let ok = 0, fail = 0;
        let i = 0;
        function next() {
            if (i >= files.length) {
                console.log(`========================================`);
                console.log(`✅ 完成：${ok} 个成功，${fail} 个失败`);
                console.log(`访问: http://${SERVER.host}:8080/`);
                console.log(`========================================`);
                sftp.end();
                conn.end();
                return;
            }
            const rel = files[i++];
            const lp = path.join(ROOT, rel);
            const rp = `${REMOTE}/${rel}`;
            if (!fs.existsSync(lp)) { console.log(`  ✗ 不存在 ${rel}`); fail++; return next(); }
            const buf = fs.readFileSync(lp);
            sftp.writeFile(rp, buf, { encoding: null }, (err) => {
                if (err) {
                    console.log(`  ✗ 失败 ${rel}: ${err.message}`);
                    fail++;
                } else {
                    console.log(`  ✓ ${rel} (${buf.length}B)`);
                    ok++;
                }
                next();
            });
        }
        next();
    });
}).on('error', e => console.error(e)).connect(SERVER);