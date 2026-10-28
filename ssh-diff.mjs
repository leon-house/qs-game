// 对比本地 vs 服务器所有 src/** 文件大小
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SERVER = { host: '106.54.31.70', port: 22, username: 'ubuntu', password: '8}iQ}3@r123' };
const REMOTE_ROOT = '/home/ubuntu/Leon-game';
const LOCAL_ROOT = path.dirname(fileURLToPath(import.meta.url));

function walk(dir, base, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        const rel = path.relative(base, p);
        if (e.isDirectory()) walk(p, base, out);
        else out.push({ rel: rel.replace(/\\/g, '/'), size: fs.statSync(p).size });
    }
    return out;
}

const localFiles = walk(LOCAL_ROOT + '/src', LOCAL_ROOT + '/src');
const map = new Map(localFiles.map(f => [f.rel, f.size]));

const conn = new Client();
conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) { console.error(err); conn.end(); return; }
        function check(dir) {
            return new Promise((resolve) => {
                sftp.readdir(dir, (err, list) => {
                    if (err) return resolve();
                    const tasks = [];
                    for (const e of list) {
                        const rel = dir.replace(REMOTE_ROOT + '/', '') + '/' + e.filename;
                        const t = (e.attrs.mode >> 11) & 0x1f;
                        if (t === 4) {
                            tasks.push(check(dir + '/' + e.filename));
                        } else {
                            const local = map.get(rel);
                            if (local !== undefined) {
                                const match = local === e.attrs.size ? '✓' : `✗ local=${local} remote=${e.attrs.size}`;
                                console.log(`${match.padEnd(40)} ${rel}`);
                            } else {
                                console.log(`?  not in local                                 ${rel}`);
                            }
                        }
                    }
                    Promise.all(tasks).then(() => resolve());
                });
            });
        }
        check(REMOTE_ROOT + '/src').then(() => { sftp.end(); conn.end(); });
    });
}).on('error', e => console.error(e)).connect(SERVER);