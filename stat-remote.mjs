import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => {
    c.exec("stat -c '%s %n' /home/ubuntu/Leon-game/src/systems/battle-canvas.js /home/ubuntu/Leon-game/src/systems/battle-v2.js /home/ubuntu/Leon-game/src/systems/challenge.js /home/ubuntu/Leon-game/src/core/storage.js /home/ubuntu/Leon-game/src/main.js /home/ubuntu/Leon-game/index.html /home/ubuntu/Leon-game/style.css", (e, s) => {
        if (e) throw e;
        s.stdout.on('data', d => process.stdout.write(d));
        s.stderr.on('data', d => process.stderr.write(d));
        s.on('close', code => { c.end(); if (code) process.exitCode = code; });
    });
}).connect({ host: '106.54.31.70', port: 22, username: 'ubuntu', password: '8}iQ}3@r123' });