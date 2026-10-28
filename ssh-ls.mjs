// 检查服务器文件
import { Client } from 'ssh2';

const SERVER = { host: '106.54.31.70', port: 22, username: 'ubuntu', password: '8}iQ}3@r123' };

const conn = new Client();
conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) { console.error(err); conn.end(); return; }
        const paths = [
            '/home/ubuntu/Leon-game',
            '/home/ubuntu/Leon-game/src',
            '/home/ubuntu/Leon-game/src/systems',
            '/home/ubuntu/Leon-game/src/data',
        ];
        let i = 0;
        function next() {
            if (i >= paths.length) { sftp.end(); conn.end(); return; }
            const p = paths[i++];
            sftp.readdir(p, (err, list) => {
                if (err) { console.log(`${p}: ERROR ${err.message}`); next(); return; }
                console.log(`=== ${p} (${list.length} entries) ===`);
                for (const e of list) {
                    const t = (e.attrs.mode >> 11) & 0x1f;
                    const type = t === 4 ? 'd' : '-';
                    console.log(`  ${type} ${String(e.attrs.size).padStart(8)} ${e.filename}`);
                }
                next();
            });
        }
        next();
    });
}).on('error', e => console.error(e)).connect(SERVER);