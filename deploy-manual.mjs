// deploy-manual.mjs - 用 sftp.createWriteStream 上传（绕过 fastPut 在某些连接上的 ENOENT bug）
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER = {
    host: '106.54.31.70',
    port: 22,
    username: 'ubuntu',
    password: '8}iQ}3@r123',
    readyTimeout: 30000
};

const REMOTE_DIR = '/home/ubuntu/Leon-game';
const LOCAL_DIR = path.join(__dirname, 'dist-release');

function listFiles(localDir) {
    const result = [];
    function walk(dir, baseDir = localDir) {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, item.name);
            const stats = fs.statSync(fullPath);
            const relative = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            if (stats.isFile()) result.push({ localPath: fullPath, remotePath: relative, size: stats.size });
            else if (stats.isDirectory()) walk(fullPath, baseDir);
        }
    }
    walk(localDir);
    return result;
}

function uploadOne(sftp, local, remote) {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(local);
        const writeStream = sftp.createWriteStream(remote, { flags: 'w', mode: 0o644 });
        let settled = false;
        const done = (err) => {
            if (settled) return;
            settled = true;
            if (err) reject(err); else resolve();
        };
        readStream.on('error', done);
        writeStream.on('error', done);
        writeStream.on('close', () => done());
        readStream.pipe(writeStream);
    });
}

const conn = new Client();
conn.on('ready', () => {
    console.log('✓ SSH ready');
    conn.sftp(async (err, sftp) => {
        if (err) { console.error('SFTP:', err); conn.end(); return; }
        const files = listFiles(LOCAL_DIR);
        const dirs = new Set();
        for (const f of files) {
            const d = path.posix.dirname(f.remotePath);
            if (d && d !== '.') {
                const parts = d.split('/');
                let cur = '';
                for (const p of parts) { cur = cur ? cur + '/' + p : p; dirs.add(cur); }
            }
        }
        for (const d of dirs) {
            await new Promise(r => sftp.mkdir(`${REMOTE_DIR}/${d}`, { mode: 0o755 }, () => r()));
        }
        console.log(`✓ ${dirs.size} dirs, ${files.length} files to upload`);

        let ok = 0, fail = 0;
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            try {
                await uploadOne(sftp, f.localPath, `${REMOTE_DIR}/${f.remotePath}`);
                ok++;
                process.stdout.write(`  [${i + 1}/${files.length}] ✓ ${f.remotePath}\r`);
            } catch (e) {
                fail++;
                process.stdout.write(`  [${i + 1}/${files.length}] ✗ ${f.remotePath}: ${e.message}\n`);
            }
        }
        console.log(`\n✓ ${ok} uploaded, ${fail} failed`);
        sftp.end();
        conn.end();
    });
}).on('error', (err) => { console.error('SSH:', err); process.exit(1); }).connect(SERVER);