import { Client } from 'ssh2';
const c = new Client();
c.on('ready', async () => {
    c.exec('echo "===index.html mtime==="; stat -c "%y %s" /home/ubuntu/Leon-game/index.html; echo "===style.css mtime==="; stat -c "%y %s" /home/ubuntu/Leon-game/style.css; echo "===main.js mtime==="; stat -c "%y %s" /home/ubuntu/Leon-game/src/main.js; echo "===checkin CSS==="; grep -A 3 ".checkin-days" /home/ubuntu/Leon-game/style.css | head -10; echo "===grep弹窗互斥==="; grep -A 4 "互斥" /home/ubuntu/Leon-game/src/core/renderer.js | head -10; echo "===nginx配置==="; cat /etc/nginx/sites-enabled/game; echo "===nginx是否开了proxy_cache==="; grep -E "proxy_cache|expires|add_header" /etc/nginx/sites-enabled/* /etc/nginx/nginx.conf 2>/dev/null', (err, stream) => {
        let out = '';
        stream.on('data', d => out += d.toString());
        stream.on('close', () => { console.log(out); c.end(); });
    });
});
c.connect({host: '106.54.31.70', port: 22, username: 'ubuntu', password: '8}iQ}3@r123', readyTimeout: 10000});