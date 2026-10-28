// upload-5files.mjs - 上传新创建的 5 个系统模块到服务器
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
};
const REMOTE_DIR = '/home/ubuntu/Leon-game';
const FILES = [
    'src/systems/evolution-lab.js',
    'src/systems/power-plant.js',
    'src/systems/training-ground.js',
    'src/systems/shop-level.js',
    'src/systems/shelter-v2.js',
];

function sftpUpload(conn) {
    return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const uploadOne = (i) => {
                if (i >= FILES.length) {
                    sftp.end();
                    return resolve();
                }
                const rel = FILES[i];
                const localPath = path.join(__dirname, 'dist-release', rel);
                const remotePath = `${REMOTE_DIR}/${rel}`;
                sftp.fastPut(localPath, remotePath, (err) => {
                    if (err) return reject(err);
                    const sz = fs.statSync(localPath).size;
                    console.log(`  ✓ ${rel} (${sz}B) → ${remotePath}`);
                    uploadOne(i + 1);
                });
            };
            uploadOne(0);
        });
    });
}

const conn = new Client();
conn.on('ready', async () => {
    console.log('✓ SSH 连接成功');
    try {
        await sftpUpload(conn);
        console.log('========================================');
        console.log('✅ 5 个新文件上传完成');
        console.log('访问: http://106.54.31.70:8080/');
        console.log('========================================');
    } catch (e) {
        console.error('✗ 上传失败:', e.message);
    } finally {
        conn.end();
    }
}).on('error', (err) => {
    console.error('SSH 错误:', err.message);
}).connect(SERVER);