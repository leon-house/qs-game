// upload-patch.mjs - 通用补丁上传（自定义文件列表）
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SERVER = {
    host: '106.54.31.70',
    port: 22,
    username: 'ubuntu',
    password: '8}iQ}3@r123',
};
const REMOTE_DIR = '/home/ubuntu/Leon-game';

// 从命令行参数接收文件列表
// node upload-patch.mjs index.html style.css src/systems/foo.js
const FILES = process.argv.slice(2);
if (FILES.length === 0) {
    console.error('用法: node upload-patch.mjs <file1> [file2] [...]');
    console.error('例: node upload-patch.mjs index.html style.css src/systems/foo.js');
    process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sftpUpload(conn, files) {
    return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const uploadOne = (i) => {
                if (i >= files.length) {
                    sftp.end();
                    return resolve();
                }
                const rel = files[i];
                const localPath = path.join(__dirname, rel);
                if (!fs.existsSync(localPath)) {
                    console.error(`  ✗ 本地文件不存在: ${localPath}`);
                    return uploadOne(i + 1);
                }
                const remotePath = `${REMOTE_DIR}/${rel}`;
                sftp.fastPut(localPath, remotePath, (err) => {
                    if (err) {
                        console.error(`  ✗ 上传失败: ${rel}`);
                        return reject(err);
                    }
                    const sz = fs.statSync(localPath).size;
                    console.log(`  ✓ ${rel} (${sz}B)`);
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
        await sftpUpload(conn, FILES);
        console.log(`========================================`);
        console.log(`✅ ${FILES.length} 个文件上传完成`);
        console.log(`访问: http://${SERVER.host}:8080/`);
        console.log(`========================================`);
    } catch (e) {
        console.error('✗ 上传失败:', e.message);
    } finally {
        conn.end();
    }
}).on('error', (err) => {
    console.error('SSH 错误:', err.message);
}).connect(SERVER);