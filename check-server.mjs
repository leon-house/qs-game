// 快速检查服务器状态
import { Client } from 'ssh2';

const SERVER = {
    host: '106.54.31.70',
    port: 22,
    username: 'ubuntu',
    password: '8}iQ}3@r123',
    readyTimeout: 15000
};

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

const client = new Client();
client.on('ready', async () => {
    console.log('✓ SSH 连接成功\n');
    try {
        const checks = [
            'echo "=== 端口监听 ===" && ss -tlnp 2>/dev/null | grep -E ":(80|8080|443)" ',
            'echo "=== 80 端口 nginx 测试 ===" && curl -s -o /dev/null -w "HTTP %{http_code}\\n" http://127.0.0.1:80/ --max-time 3',
            'echo "=== 8080 端口测试 ===" && curl -s -o /dev/null -w "HTTP %{http_code}\\n" http://127.0.0.1:8080/ --max-time 3',
            'echo "=== nginx 站点 ===" && ls /etc/nginx/sites-enabled/ 2>/dev/null && cat /etc/nginx/sites-enabled/* 2>/dev/null | head -30',
            'echo "=== 文件列表 ===" && ls -la /home/ubuntu/Leon-game/ | head -10',
            'echo "=== 进程列表 (前 20 行) ===" && ps aux | head -20'
        ];

        for (const cmd of checks) {
            console.log(`\n$ ${cmd.split('\n')[0]}`);
            const result = await execCmd(client, cmd);
            console.log(result.stdout || '(无输出)');
        }
    } catch (e) {
        console.error('错误:', e.message);
    } finally {
        client.end();
    }
});
client.on('error', (err) => console.error('连接错误:', err.message));
client.connect(SERVER);
