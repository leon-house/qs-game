// 上传 nginx_game.conf 并 reload nginx（通过 sudo）
import { Client } from 'ssh2';
import fs from 'fs';

const c = new Client();
c.on('ready', async () => {
    console.log('✓ SSH 连接');
    const conf = fs.readFileSync('C:/Users/32545/WorkBuddy/2026-07-23-09-44-01/nginx_game.conf', 'utf8');

    const sftp = await new Promise((res, rej) => c.sftp((e, s) => e ? rej(e) : res(s)));

    await new Promise((res, rej) => sftp.writeFile('/tmp/nginx_game.conf.new', Buffer.from(conf), e => e ? rej(e) : res()));
    console.log('✓ 配置已上传到 /tmp');

    await new Promise((res) => c.exec('sudo bash -c "cp /tmp/nginx_game.conf.new /etc/nginx/sites-available/game && nginx -t && nginx -s reload && echo OK_NGINX_RELOADED"', { pty: true }, (e, s) => {
        s.on('data', d => process.stdout.write(d));
        s.on('close', (code) => { console.log(`\n[exit ${code}]`); res(); c.end(); });
    }));
});
c.on('error', e => { console.error('SSH err:', e.message); process.exit(1); });
c.connect({ host: '106.54.31.70', port: 22, username: 'ubuntu', password: '8}iQ}3@r123', readyTimeout: 15000 });
