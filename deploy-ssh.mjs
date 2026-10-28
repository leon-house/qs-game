// SSH + SFTP 部署 — 简洁版（用 sync 一次性枚举，async/await 顺序上传）
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
    readyTimeout: 15000
};

const REMOTE_DIR = '/home/ubuntu/Leon-game';
const LOCAL_DIR = path.join(__dirname, 'dist-release');
const STATIC_PORT = 8080;

function execCmd(client, command) {
    return new Promise((resolve, reject) => {
        client.exec(command, (err, stream) => {
            if (err) return reject(err);
            let stdout = '';
            stream.on('close', (code) => resolve({ code, stdout }));
            stream.on('data', (data) => { stdout += data.toString(); });
        });
    });
}

function listFiles(localDir) {
    const result = [];
    function walk(dir, baseDir = localDir) {
        for (const item of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, item);
            const stats = fs.statSync(fullPath);
            const relative = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            if (stats.isFile()) {
                result.push({ localPath: fullPath, remotePath: relative });
            } else if (stats.isDirectory()) {
                walk(fullPath, baseDir);
            }
        }
    }
    walk(localDir);
    return result;
}

function getUniqueDirs(files) {
    const dirs = new Set();
    for (const f of files) {
        const d = path.posix.dirname(f.remotePath);
        if (d && d !== '.') {
            // 也需要所有祖先目录
            const parts = d.split('/');
            let cur = '';
            for (const p of parts) {
                cur = cur ? cur + '/' + p : p;
                dirs.add(cur);
            }
        }
    }
    return Array.from(dirs);
}

function sftpMkdir(sftp, dir) {
    return new Promise((resolve, reject) => {
        sftp.mkdir(dir, { mode: 0o755 }, (err) => {
            // EEXIST 是正常的
            resolve();
        });
    });
}

function sftpPut(sftp, local, remote) {
    return new Promise((resolve, reject) => {
        sftp.fastPut(local, remote, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

async function main() {
    const client = new Client();

    // 关键：处理超时
    client.on('ready', async () => {
        console.log('✓ SSH 连接成功');

        try {
            const who = await execCmd(client, 'whoami && hostname -I');
            console.log('服务器信息:', who.stdout.trim().replace(/\n/g, ' | '));

            // 1. 编译 Sass + Tailwind → dist-release/style.css
            console.log('\n🔨 编译 Sass + Tailwind...');
            const { execSync } = await import('child_process');
            try {
                execSync('node build-sass.mjs', { stdio: 'inherit', cwd: process.cwd() });
            } catch (e) {
                console.log('⚠️  Sass 编译失败，使用现有 style.css 继续部署');
            }

            // 准备远程目录（动态发现所有需要的子目录）
            const files = listFiles(LOCAL_DIR);
            await execCmd(client, `rm -rf ${REMOTE_DIR}`);
            const subdirs = new Set(['', 'src', 'src/core', 'src/data', 'src/systems', 'src/ui', 'assets', 'assets/images']);
            for (const f of files) {
                const d = path.posix.dirname(f.remotePath);
                if (d && d !== '.') {
                    const parts = d.split('/');
                    let cur = '';
                    for (const p of parts) {
                        cur = cur ? cur + '/' + p : p;
                        subdirs.add(cur);
                    }
                }
            }
            for (const subdir of subdirs) {
                await execCmd(client, `mkdir -p ${REMOTE_DIR}/${subdir}`);
            }
            console.log(`✓ 远程目录 ${REMOTE_DIR} 准备好（${subdirs.size} 个子目录）`);

            // SFTP 上传
            const sftp = await new Promise((resolve, reject) => {
                client.sftp((err, sftp) => {
                    if (err) return reject(err);
                    resolve(sftp);
                });
            });
            console.log('✓ SFTP 就绪');

            const totalSize = files.reduce((sum, f) => sum + fs.statSync(f.localPath).size, 0);
            console.log(`✓ 发现 ${files.length} 个文件，总大小 ${(totalSize / 1024).toFixed(1)}KB`);

            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                await sftpPut(sftp, f.localPath, `${REMOTE_DIR}/${f.remotePath}`);
                process.stdout.write(`  [${i + 1}/${files.length}] ✓ ${f.remotePath}\r`);
            }
            console.log('\n✓ 所有文件上传完成');

            sftp.end();

            // 启动 HTTP 服务器（带 no-cache 头，避免浏览器缓存导致用户看不到新版本）
            console.log(`\n✓ 启动 HTTP 服务器 :${STATIC_PORT}（带 no-cache 头）`);
            await execCmd(client, `
                pkill -f "http.server" 2>/dev/null || true
                pkill -f "qs-game-server" 2>/dev/null || true
                sleep 1
                cat > /tmp/qs-game-server.py <<PYEOF
import http.server, socketserver
class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
with socketserver.TCPServer(('0.0.0.0', ${STATIC_PORT}), NoCacheHandler) as httpd:
    httpd.serve_forever()
PYEOF
                nohup python3 /tmp/qs-game-server.py > /tmp/qs-game.log 2>&1 &
                disown
                sleep 2
                echo "Server started on port ${STATIC_PORT}"
            `);

            const localCheck = await execCmd(client, `curl -s -o /dev/null -w "Local: HTTP %{http_code}\\n" http://127.0.0.1:${STATIC_PORT}/`);
            console.log(localCheck.stdout.trim());

            const portInfo = await execCmd(client, `ss -tlnp 2>/dev/null | grep :${STATIC_PORT}`);
            console.log('端口监听:', portInfo.stdout.trim() || '(无 ss 输出)');

            console.log('\n========================================');
            console.log(`✅ 部署完成`);
            console.log(`访问: http://${SERVER.host}:${STATIC_PORT}/`);
            console.log('========================================');
        } catch (e) {
            console.error('部署错误:', e.message);
            console.error(e.stack);
        } finally {
            client.end();
        }
    });

    client.on('error', (err) => {
        console.error('✗ SSH 连接错误:', err.message);
        process.exit(1);
    });

    client.connect(SERVER);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
